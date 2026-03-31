import { getLocalStorage, setLocalStorage } from "@/utils/localStorage";
import {
  Bewt,
  BewtActive,
  Bewts,
  BewtsActive,
  Chat,
  ChatActive,
  Notif,
  NotifActive,
  Request,
  RequestActive,
  Search,
  SearchActive,
  Top,
  TopActive,
} from "./components/icons";

export const STORAGE_KEY = "sidebar:isOpen";

export type SidebarMenuItemChild = {
  label: string;
  href: string;
};

export type SidebarMenuItem = {
  label: string;
  href: string;
  match: string;
  icon?: {
    active: React.ReactNode;
    inactive: React.ReactNode;
  };
  children?: SidebarMenuItemChild[];
};

export const sidebarMenuItems: SidebarMenuItem[] = [
  {
    label: "トップ",
    href: "/",
    match: "/",
    icon: { active: <TopActive />, inactive: <Top /> },
  },
  {
    label: "通知",
    href: "/notifs",
    match: "/notifs",
    icon: { active: <NotifActive />, inactive: <Notif /> },
  },
  {
    label: "検索",
    href: "/search/apps",
    match: "/search",
    icon: { active: <SearchActive />, inactive: <Search /> },
    children: [
      { label: "アプリ", href: "/search/apps" },
      { label: "ユーザ", href: "/search/users" },
    ],
  },
  {
    label: "チャット",
    href: "/chat",
    match: "/chat",
    icon: { active: <ChatActive />, inactive: <Chat /> },
  },
  {
    label: "ビュート",
    href: "/bewt",
    match: "/bewt",
    icon: { active: <BewtActive />, inactive: <Bewt /> },
  },
  {
    label: "ビューズ",
    href: "/bewts",
    match: "/bewts",
    icon: { active: <BewtsActive />, inactive: <Bewts /> },
    children: [
      { label: "募集中プロジェクト一覧", href: "/bewts" },
      { label: "参加中プロジェクト一覧", href: "/bewts/joined" },
      { label: "募集", href: "/bewts/new" },
    ],
  },
  {
    label: "リクエスト",
    href: "/requests",
    match: "/requests",
    icon: { active: <RequestActive />, inactive: <Request /> },
    children: [
      { label: "一覧", href: "/requests" },
      { label: "投稿", href: "/requests/new" },
    ],
  },
  {
    label: "マイページ",
    href: "/mypage/purchases",
    match: "/mypage",
    children: [
      { label: "購入一覧", href: "/mypage/purchases" },
      { label: "出品一覧", href: "/mypage/products" },
      { label: "Wコイン", href: "/mypage/wcoin" },
      { label: "プロフィール", href: "/mypage/profile" },
      { label: "設定", href: "/mypage/settings" },
    ],
  },
];

export function getSidebarOpen() {
  return getLocalStorage(STORAGE_KEY, false);
}

export function setSidebarOpen(isOpen: boolean) {
  setLocalStorage(STORAGE_KEY, isOpen);
}
