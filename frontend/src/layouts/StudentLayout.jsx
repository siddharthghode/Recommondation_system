import React from 'react';
import { Outlet } from 'react-router-dom';
import StudentNavbar from '../components/navigation/StudentNavbar';
import Footer from '../components/Footer';

export default function StudentLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <StudentNavbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
