/* eslint-disable-next-line no-unused-vars */
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function PageTransition({ children }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      style={{ width: "100%" }}
    >
      {children}
    </motion.div>
  );
}
