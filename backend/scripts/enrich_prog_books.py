import pandas as pd
import urllib.request
import urllib.parse
import json
import re
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

CSV_PATH = '/home/sidhharth/sppu/git/Recommondation_system/backend/data/prog_book.csv'
DOWNLOADS_PATH = '/home/sidhharth/Downloads/prog_book.csv'

# Backup original
backup_path = '/home/sidhharth/sppu/git/Recommondation_system/backend/data/prog_book_backup.csv'
if not os.path.exists(backup_path):
    df_raw = pd.read_csv(CSV_PATH)
    df_raw.to_csv(backup_path, index=False)
    print(f"✓ Backed up original to {backup_path}")

df = pd.read_csv(CSV_PATH)

def clean_description(desc):
    if not isinstance(desc, str) or pd.isna(desc):
        return ""
    # Remove Goodreads trailing "...more" or "...more\n"
    desc = re.sub(r'(\s*\.\.\.\s*more|\s*\.\.\.more)\s*$', '', desc, flags=re.IGNORECASE)
    # Normalize excessive newlines
    desc = re.sub(r'\n{3,}', '\n\n', desc).strip()
    return desc

def search_openlibrary(title):
    # Try searching with clean title
    search_terms = [
        title.split(':')[0].strip(), # Primary title without subtitle
        re.sub(r'\(.*?\)', '', title).strip(), # Without parentheses
        title.strip()
    ]
    
    headers = {'User-Agent': 'LibraryCatalogEnricher/2.0 (education research bot)'}
    
    for term in search_terms:
        if not term:
            continue
        try:
            url = f"https://openlibrary.org/search.json?title={urllib.parse.quote(term)}&limit=3"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                docs = data.get('docs', [])
                for d in docs:
                    authors = d.get('author_name', [])
                    cover_id = d.get('cover_i')
                    isbn = (d.get('isbn') or [None])[0]
                    year = d.get('first_publish_year') or (d.get('publish_year') or [None])[0]
                    subjects = d.get('subject', [])
                    
                    thumb = ""
                    if cover_id:
                        thumb = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
                    elif isbn:
                        thumb = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
                        
                    if authors or thumb:
                        # Deduplicate authors preserving order
                        clean_authors = []
                        for a in authors:
                            if a not in clean_authors:
                                clean_authors.append(a)
                        
                        return {
                            'authors': ', '.join(clean_authors[:4]) if clean_authors else '',
                            'thumbnail': thumb,
                            'published_year': year,
                            'subjects': subjects[:3]
                        }
        except Exception:
            pass
        time.sleep(0.1)

    # Fallback to general q= search
    try:
        url = f"https://openlibrary.org/search.json?q={urllib.parse.quote(title)}&limit=2"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            docs = data.get('docs', [])
            if docs:
                d = docs[0]
                authors = d.get('author_name', [])
                cover_id = d.get('cover_i')
                isbn = (d.get('isbn') or [None])[0]
                year = d.get('first_publish_year') or (d.get('publish_year') or [None])[0]
                
                thumb = ""
                if cover_id:
                    thumb = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
                elif isbn:
                    thumb = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
                    
                clean_authors = []
                for a in authors:
                    if a not in clean_authors:
                        clean_authors.append(a)
                        
                return {
                    'authors': ', '.join(clean_authors[:4]) if clean_authors else '',
                    'thumbnail': thumb,
                    'published_year': year,
                    'subjects': d.get('subject', [])[:3]
                }
    except Exception:
        pass
        
    return {'authors': '', 'thumbnail': '', 'published_year': None, 'subjects': []}

print(f"Starting enrichment for {len(df)} books in prog_book.csv...")

enriched_rows = []

def process_item(idx, row):
    title = str(row['Book_title']).strip()
    raw_desc = clean_description(row.get('Description', ''))
    
    info = search_openlibrary(title)
    
    authors = info['authors'] or "Various Authors"
    thumbnail = info['thumbnail']
    year = info['published_year']
    
    # Clean category
    subjects = info.get('subjects', [])
    categories = "Computers, Programming"
    if subjects:
        categories = ', '.join(subjects)
        
    # Default thumbnail if missing
    if not thumbnail:
        thumbnail = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=560&fit=crop"
        
    return {
        'idx': idx,
        'Rating': row.get('Rating'),
        'Reviews': row.get('Reviews'),
        'Book_title': title,
        'authors': authors,
        'categories': categories,
        'thumbnail': thumbnail,
        'description': raw_desc,
        'Number_Of_Pages': row.get('Number_Of_Pages'),
        'published_year': year,
        'Type': row.get('Type'),
        'Price': row.get('Price')
    }

start_time = time.time()
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(process_item, idx, row) for idx, row in df.iterrows()]
    
    completed = 0
    results = []
    for f in as_completed(futures):
        res = f.result()
        results.append(res)
        completed += 1
        if completed % 25 == 0 or completed == len(df):
            print(f"  Processed {completed}/{len(df)} books ({completed/len(df)*100:.1f}%) in {time.time()-start_time:.1f}s")

# Sort back by original index
results.sort(key=lambda x: x['idx'])
for r in results:
    del r['idx']

df_enriched = pd.DataFrame(results)

# Save to both paths
df_enriched.to_csv(CSV_PATH, index=False)
df_enriched.to_csv(DOWNLOADS_PATH, index=False)

print(f"\n✅ Completed! Enriched CSV saved to:")
print(f"   1. {CSV_PATH}")
print(f"   2. {DOWNLOADS_PATH}")
print(f"\nEnriched Sample:")
print(df_enriched[['Book_title', 'authors', 'thumbnail', 'published_year']].head(10))
