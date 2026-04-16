import { LoginWrapper } from "./LoginWrapper";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LoginWrapper>{children}</LoginWrapper>;
}
