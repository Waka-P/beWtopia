import { DownloadPanel } from "../../components/DownloadPanel";
import { DownloadProvider } from "../../contexts/DownloadContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DownloadProvider>
      {children}
      <DownloadPanel />
    </DownloadProvider>
  );
}
