import type {Metadata} from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Attribution Analysis MVP",
  description: "Internal Shopify attribution analysis dashboard"
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
