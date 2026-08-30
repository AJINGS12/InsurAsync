"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

function SyncMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none">
      <path
        d="M8 6a7 7 0 1 1-4.5 9.5"
        stroke="#B8863B"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 20a7 7 0 1 1 4.5-9.5"
        stroke="#16213A"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Live log" },
  { href: "/policyholder", label: "Policyholder" },
  { href: "/insurer", label: "Insurer" },
  { href: "/repair-shop", label: "Repair shop" }
];

export default function RootLayout({ children }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="wordmark">
              <SyncMark />
              <span className="wordmark-text">InsurAsync</span>
            </Link>
          </div>
          <nav className="nav-tabs">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-tab ${pathname === item.href ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}