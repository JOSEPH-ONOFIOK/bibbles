import { Ambient } from "./Ambient";
import { Footer } from "./Footer";
import { Nav } from "./Nav";
import { SessionProvider } from "./Session";
import { WallProvider } from "./WallContext";

// Everything around a page's content: sign-in, the menu and the footer
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WallProvider>
        <Ambient />
        <Nav />
        <main>{children}</main>
        <Footer />
      </WallProvider>
    </SessionProvider>
  );
}
