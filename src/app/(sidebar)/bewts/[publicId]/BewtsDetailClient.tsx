"use client";
import Avatar from "@/components/Avatar";
import { UserConfirmModal } from "@/components/BlockUserConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import { JoinRequestModal } from "@/components/JoinRequestModal";
import type { BewtsCapability } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BewtsCapabilityPicker } from "../../components/BewtsCapabilityPicker";
import { RolePicker } from "../../components/RolePicker";
import styles from "./BewtsDetail.module.scss";
import BewtsDetailNavButton from "./BewtsDetailNavButton";

type Member = {
  id: number;
  name: string;
  image: string | null;
  isOwner?: boolean;
};
type Role = {
  id: number;
  name: string;
  isLeader?: boolean;
  percentage: number;
  members: Member[];
};
type JoinRequest = {
  id: number;
  message: string | null;
  createdAt: string;
  status?: "PENDING" | "APPROVED" | "DECLINED";
  updatedAt?: string;
  roleIds?: number[];
  roleNames?: string[];
  roleId?: number | null;
  capabilities?: BewtsCapability[];
  user: {
    publicId: string;
    name: string;
    image: string | null;
  };
};
type ProjectProp = {
  id: number;
  publicId: string;
  name: string;
  description: string;
  status: string;
  skills: string[];
  progress?: number | null;
  // Gantt tasks shown under "開発進捗"
  tasks?: { id: number; name: string; progress: number }[];
  memberCount: number;
  maxMembers?: number | null;
  // 総員（リーダー含む現在の人数）と総キャパシティ（leader + maxMembers）
  totalMemberCount?: number;
  totalCapacity?: number | null;
  roles: Role[];
  members: Member[];
  isJoined?: boolean;
  isLeader?: boolean;
  // サーバー側で判定した権限フラグ
  isAdmin?: boolean;
  isPublisher?: boolean;
  // サーバー側で判定した "ADMIN" 権限フラグ
  joinRequests?: JoinRequest[];
  // サーバー側で判定した「既に申請済みか」フラグ
  hasApplied?: boolean;
};

export default function BewtsDetailView({ project }: { project: ProjectProp }) {
  const projectTitleRef = useRef<HTMLHeadingElement | null>(null);
  const joinRequestsRef = useRef<HTMLElement | null>(null);
  const [projectTitleOverflow, setProjectTitleOverflow] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);

  // 申請済み表示（APIで既存申請を弾くため、ローカル状態でボタンの見た目を即時更新）
  const [hasApplied, setHasApplied] = useState<boolean>(
    Boolean(project.hasApplied),
  );

  // 確認モーダル（承認／見送り用）
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: number;
    action: "approve" | "decline";
    roleIds?: number[];
    capabilities?: BewtsCapability[];
    userName: string;
    userImage: string | null;
  } | null>(null);
  const [confirmProcessing, setConfirmProcessing] = useState(false);

  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // リーダー／Admin が承認時に選べる役割（UI 用）
  const [selectedRoleForRequest, setSelectedRoleForRequest] = useState<
    Record<number, number[]>
  >({});
  const [selectedCapabilitiesForRequest, setSelectedCapabilitiesForRequest] =
    useState<Record<number, BewtsCapability[]>>({});
  const router = useRouter();

  const getStatusText = (status: string) => {
    switch (status) {
      case "RECRUITING":
        return "募集中";
      case "DEVELOPING":
        return "開発中";
      case "COMPLETED":
        return "完了済";
      default:
        return status;
    }
  };

  const previewMembers = project.members.slice(0, 4);
  const hasJoinRequests =
    (project.isLeader || project.isAdmin) &&
    project.joinRequests &&
    project.joinRequests.length > 0;
  const roleMemberIdSetMap = new Map(
    project.roles.map((role) => [
      role.id,
      new Set(role.members.map((member) => member.id)),
    ]),
  );
  const assignableRoles = project.roles.filter((role) => !role.isLeader);
  const assignableRoleIdSet = new Set(assignableRoles.map((role) => role.id));
  const backHref = project.isJoined ? "/bewts/joined" : "/bewts";

  const jumpToJoinRequests = () => {
    if (!hasJoinRequests) return;
    setShowJoinRequests(true);
    joinRequestsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // 現在時刻（UI 内での残り時間表示に利用）
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const measure = () => {
      const titleEl = projectTitleRef.current;
      if (!titleEl) return;
      const overflow = Math.max(titleEl.scrollWidth - titleEl.clientWidth, 0);
      setProjectTitleOverflow(overflow);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link href={backHref} className={styles.trail}>
          <span className={styles.trailArrow}>&#9664;</span>
          {project.isJoined
            ? "参加中プロジェクト一覧"
            : "募集中プロジェクト一覧"}
        </Link>
      </div>

      <div className={styles.titleBlock}>
        <h1
          ref={projectTitleRef}
          className={cn(
            styles.projectTitle,
            projectTitleOverflow > 0 && styles.marqueeReady,
          )}
          style={
            {
              "--marquee-distance": `${projectTitleOverflow}px`,
            } as CSSProperties
          }
        >
          <span className={styles.marqueeText}>{project.name}</span>
        </h1>
        <span className={styles.statusBadge}>
          <span className={styles.statusDot} />
          {getStatusText(project.status)}
        </span>
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.sectionLabel}>プロジェクト概要</div>
          <p className={styles.description}>{project.description}</p>

          <div style={{ marginTop: 28 }}>
            <div className={styles.sectionLabel}>技術スタック</div>
            <div className={styles.techList}>
              {project.skills.map((s: string) => (
                <span key={s} className={styles.techTag}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className={styles.sectionLabel}>開発進捗</div>
          <div className={styles.progressLabel}>
            <span>全体進捗</span>
            <span style={{ color: "var(--cyan)", fontFamily: "Space Mono" }}>
              {project.progress ?? 0}%
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${project.progress ?? 0}%` }}
            />
          </div>
          <ul className={styles.milestoneList}>
            {(project.tasks ?? []).map((t) => {
              const done = typeof t.progress === "number" && t.progress >= 100;
              return (
                <li
                  key={t.id}
                  className={cn(styles.milestone, done && styles.done)}
                >
                  <span className={styles.milestoneIcon}>
                    {done ? "✓" : ""}
                  </span>
                  <span>{t.name}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: "var(--text-muted)",
                      fontFamily: "Space Mono",
                    }}
                  >
                    {typeof t.progress === "number" ? `${t.progress}%` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <section className={styles.membersSection}>
        <header className={styles.membersHeader}>
          <div className={styles.membersHeaderBtn}>
            <div className={styles.membersHeaderLeft}>
              <span className={styles.membersTitle}>メンバー</span>
              <div className={styles.membersCountCont}>
                <span
                  className={cn(
                    styles.membersCount,
                    project.maxMembers &&
                      project.maxMembers - project.memberCount <= 1 &&
                      styles.nearFull,
                  )}
                >
                  {project.memberCount} / {project.maxMembers ?? "—"}名
                </span>

                {typeof project.totalCapacity === "number" && (
                  <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    （総員: {project.totalMemberCount}/{project.totalCapacity}
                    名）
                  </small>
                )}
              </div>
              <div className={styles.previewAvatars}>
                {previewMembers.map((m: Member) => (
                  <Avatar
                    key={m.id}
                    src={m.image}
                    alt={`${m.name}さんのアイコン`}
                    className={styles.previewAvatar}
                  />
                ))}
                {project.memberCount > 4 && (
                  <div className={styles.previewMore}>
                    +{project.memberCount - 4}
                  </div>
                )}
              </div>
            </div>
            {hasJoinRequests && (
              <button
                type="button"
                className={styles.jumpToRequestsBtn}
                onClick={jumpToJoinRequests}
              >
                参加申請へ ({project.joinRequests?.length ?? 0})
              </button>
            )}
          </div>
        </header>

        <div className={styles.membersMatrixWrap}>
          <table className={styles.membersMatrix}>
            <thead>
              <tr>
                <th className={styles.memberCellHead}>メンバー</th>
                {project.roles.map((role) => (
                  <th key={role.id} className={styles.roleHeadCell}>
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.members.map((member) => (
                <tr key={member.id}>
                  <td className={styles.memberCell}>
                    <Avatar
                      src={member.image}
                      alt={`${member.name}さんのアイコン`}
                      className={styles.memberAvatar}
                    />
                    <span className={styles.memberName}>{member.name}</span>
                  </td>
                  {project.roles.map((role) => {
                    const hasRole = roleMemberIdSetMap
                      .get(role.id)
                      ?.has(member.id);
                    return (
                      <td
                        key={`${member.id}-${role.id}`}
                        className={styles.roleCell}
                      >
                        {hasRole ? (
                          <Image
                            src="/images/check-outlined.png"
                            alt="役割あり"
                            width={22}
                            height={22}
                            className={styles.roleCheckIcon}
                          />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* リーダー専用: 参加申請リスト */}
      {(project.isLeader || project.isAdmin) &&
        project.joinRequests &&
        project.joinRequests.length > 0 && (
          <section className={styles.joinRequestsSection} ref={joinRequestsRef}>
            <button
              type="button"
              className={styles.joinRequestsHeader}
              onClick={() => setShowJoinRequests(!showJoinRequests)}
            >
              <span className={styles.joinReqLabel}>
                参加申請 ({project.joinRequests.length})
              </span>
              <span
                className={cn(
                  styles.expandIcon,
                  showJoinRequests && styles.rotate,
                )}
              >
                ▼
              </span>
            </button>

            <div
              className={cn(
                styles.joinRequestsBody,
                showJoinRequests && styles.open,
              )}
            >
              {project.joinRequests.map((req) => (
                <div key={req.id} className={styles.joinRequestItem}>
                  <div className={styles.joinRequestHeader}>
                    <Avatar
                      src={req.user.image}
                      alt={`${req.user.name}さんのアイコン`}
                    />
                    <div className={styles.joinRequestInfo}>
                      <div className={styles.joinRequestName}>
                        {req.user.name}
                      </div>
                      <div className={styles.joinRequestTime}>
                        {new Date(req.createdAt).toLocaleDateString("ja-JP", {
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 希望役割があれば表示 */}
                  {(req.roleNames && req.roleNames.length > 0) ||
                  (req.roleIds && req.roleIds.length > 0) ||
                  req.roleId ? (
                    <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
                      希望役割: {(() => {
                        if (req.roleNames && req.roleNames.length > 0) {
                          return req.roleNames.join(" / ");
                        }

                        const namesFromIds = (req.roleIds ?? [])
                          .map(
                            (id) =>
                              project.roles.find((rr) => rr.id === id)?.name,
                          )
                          .filter((name): name is string => Boolean(name));

                        if (namesFromIds.length > 0) {
                          return namesFromIds.join(" / ");
                        }

                        return (
                          project.roles.find((rr) => rr.id === req.roleId)
                            ?.name ?? "—"
                        );
                      })()}
                    </div>
                  ) : null}
                  {req.message && (
                    <div className={styles.joinRequestMessage}>
                      {req.message}
                    </div>
                  )}

                  {/* 仮承認/仮辞退（確定待ち）バッジ */}
                  {(req.status === "APPROVED" || req.status === "DECLINED") &&
                  req.updatedAt
                    ? (() => {
                        const elapsed = now - new Date(req.updatedAt).getTime();
                        const remaining = Math.max(0, 1 * 60 * 1000 - elapsed);
                        if (remaining <= 0) return null;
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000)
                          .toString()
                          .padStart(2, "0");
                        return (
                          <div
                            style={{
                              marginTop: 8,
                              color: "var(--accent)",
                              fontWeight: 600,
                            }}
                          >
                            {req.status === "APPROVED"
                              ? "承認(確定待ち)"
                              : "見送り(確定待ち)"}{" "}
                            ー 残り {mins}:{secs}
                          </div>
                        );
                      })()
                    : null}

                  <div className={styles.joinRequestActions}>
                    {req.status === "PENDING" ? (
                      project.isAdmin ? (
                        <div>
                          <div className={styles.approvalPickerRow}>
                            <div className={styles.pickerField}>
                              <div className={styles.pickerLabel}>
                                割り当てる役割（必須 / 複数可）
                              </div>
                              <RolePicker
                                roles={assignableRoles.map((r) => ({
                                  id: r.id,
                                  name: r.name,
                                }))}
                                selectedRoleIds={(
                                  selectedRoleForRequest[req.id] ??
                                  req.roleIds ??
                                  (req.roleId ? [req.roleId] : [])
                                ).filter((roleId) =>
                                  assignableRoleIdSet.has(roleId),
                                )}
                                onChange={(roleIds) =>
                                  setSelectedRoleForRequest((prev) => ({
                                    ...prev,
                                    [req.id]: roleIds.filter((roleId) =>
                                      assignableRoleIdSet.has(roleId),
                                    ),
                                  }))
                                }
                                placeholder="承認役割を選択（必須・複数可）"
                                maxItems={10}
                              />
                            </div>

                            <div className={styles.pickerField}>
                              <div className={styles.pickerLabel}>
                                付与する権限（必須 / 複数可）
                              </div>
                              <BewtsCapabilityPicker
                                selectedCapabilities={
                                  selectedCapabilitiesForRequest[req.id] ??
                                  req.capabilities ?? ["SCOUT"]
                                }
                                onChange={(capabilities) =>
                                  setSelectedCapabilitiesForRequest((prev) => ({
                                    ...prev,
                                    [req.id]: capabilities,
                                  }))
                                }
                                placeholder="承認権限を選択"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            className={cn(
                              styles.joinRequestBtn,
                              styles.decline,
                            )}
                            onClick={() => {
                              setConfirmTarget({
                                id: req.id,
                                action: "decline",
                                userName: req.user.name,
                                userImage: req.user.image,
                              });
                              setConfirmOpen(true);
                            }}
                          >
                            見送る
                          </button>

                          <button
                            type="button"
                            className={cn(
                              styles.joinRequestBtn,
                              styles.approve,
                            )}
                            onClick={() => {
                              const roleIds =
                                selectedRoleForRequest[req.id] ??
                                req.roleIds ??
                                (req.roleId ? [req.roleId] : []);
                              const normalizedRoleIds = roleIds.filter(
                                (roleId) => assignableRoleIdSet.has(roleId),
                              );
                              const capabilities =
                                selectedCapabilitiesForRequest[req.id] ??
                                  req.capabilities ?? ["SCOUT"];

                              if (normalizedRoleIds.length === 0) {
                                setErrorModal({
                                  title: "役割の指定が必要です",
                                  message:
                                    "承認時は少なくとも1つの役割を選択してください。",
                                });
                                return;
                              }

                              if (capabilities.length === 0) {
                                setErrorModal({
                                  title: "権限の指定が必要です",
                                  message:
                                    "承認時は少なくとも1つの権限を選択してください。",
                                });
                                return;
                              }

                              setConfirmTarget({
                                id: req.id,
                                action: "approve",
                                roleIds: normalizedRoleIds,
                                capabilities,
                                userName: req.user.name,
                                userImage: req.user.image,
                              });
                              setConfirmOpen(true);
                            }}
                          >
                            承認する
                          </button>
                        </div>
                      ) : (
                        <div style={{ color: "var(--text-muted)" }}>
                          権限がありません
                        </div>
                      )
                    ) : (
                      // 元に戻すは承認／見送りから 5 分以内のみ表示
                      (() => {
                        const updated = req.updatedAt
                          ? new Date(req.updatedAt).getTime()
                          : 0;
                        const canUndo =
                          req.status && Date.now() - updated <= 1 * 60 * 1000;
                        if (!canUndo) return null;

                        return (
                          <button
                            type="button"
                            className={cn(
                              styles.joinRequestBtn,
                              styles.undoBtn,
                            )}
                            onClick={async () => {
                              const res = await fetch(
                                `/api/bewts/join-request/${req.id}`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ action: "undo" }),
                                },
                              );

                              if (res.ok) {
                                // 状態を元に戻す表示
                                router.refresh();
                                return;
                              }

                              const data = await res.json().catch(() => null);
                              setErrorModal({
                                title: "申請の取り消しに失敗しました",
                                message:
                                  (data?.error as string | undefined) ||
                                  "取り消し期限が過ぎている可能性があります。時間をおいて再度お試しください。",
                              });
                            }}
                          >
                            元に戻す
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      {(project.isJoined || project.isLeader) && (
        <BewtsDetailNavButton
          publicId={project.publicId}
          showBewt={Boolean(
            project.isJoined &&
              (project.isLeader || project.isAdmin || project.isPublisher),
          )}
          showSettings={Boolean(project.isAdmin)}
        />
      )}

      {!project.isJoined ? (
        project.maxMembers != null &&
        project.memberCount >= project.maxMembers ? (
          <div
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: 32,
              right: 40,
              padding: "14px 32px",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--error)",
              background: "transparent",
              borderRadius: 28,
              cursor: "default",
              letterSpacing: ".05em",
              opacity: 0.95,
              border: "1px solid rgba(196,6,6,0.08)",
              userSelect: "none",
            }}
          >
            満員
          </div>
        ) : hasApplied ? (
          <div
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: 32,
              right: 40,
              padding: "14px 32px",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-muted)",
              background: "transparent",
              borderRadius: 28,
              cursor: "default",
              letterSpacing: ".05em",
              opacity: 0.9,
              border: "1px dashed rgba(255,255,255,0.03)",
              userSelect: "none",
            }}
          >
            申請済み
          </div>
        ) : (
          <button
            type="button"
            className={styles.joinBtn}
            onClick={() => setShowJoinModal(true)}
          >
            参加申請
          </button>
        )
      ) : null}

      {/* 参加申請モーダル */}
      <JoinRequestModal
        open={showJoinModal}
        onOpenChange={setShowJoinModal}
        projectName={project.name}
        projectPublicId={project.publicId}
        availableRoles={assignableRoles.map((r) => ({
          id: r.id,
          name: r.name,
        }))}
        onSuccess={() => {
          // ローカル表示を即時に更新（ページ全体のリロードは不要）
          setHasApplied(true);
        }}
      />

      {/* リーダー用の承認確認モーダル（汎用） */}
      {confirmTarget && (
        <UserConfirmModal
          open={confirmOpen}
          onOpenChange={(o) => {
            if (!o && confirmProcessing) return;
            setConfirmOpen(o);
            if (!o) setConfirmTarget(null);
          }}
          title={
            confirmTarget.action === "approve"
              ? "この申請を承認しますか？"
              : "この申請を見送りますか？"
          }
          description={
            confirmTarget.action === "approve"
              ? "この申請を承認しますか？（1分以内に取り消せます）"
              : "この申請を見送りますか？（1分以内に取り消せます）"
          }
          userName={confirmTarget.userName}
          userImage={confirmTarget.userImage}
          confirmLabel={
            confirmTarget.action === "approve" ? "承認する" : "見送る"
          }
          cancelLabel="キャンセル"
          variant={confirmTarget.action === "approve" ? "approve" : "block"}
          processing={confirmProcessing}
          onConfirm={async () => {
            if (!confirmTarget) return;
            setConfirmProcessing(true);
            try {
              const res = await fetch(
                `/api/bewts/join-request/${confirmTarget.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: confirmTarget.action,
                    ...(confirmTarget.action === "approve" &&
                    Array.isArray(confirmTarget.roleIds)
                      ? { roleIds: confirmTarget.roleIds }
                      : {}),
                    ...(confirmTarget.action === "approve" &&
                    Array.isArray(confirmTarget.capabilities)
                      ? { capabilities: confirmTarget.capabilities }
                      : {}),
                  }),
                },
              );
              if (!res.ok) {
                const data = await res.json().catch(() => null);
                const message =
                  (data?.error as string | undefined) || "処理に失敗しました";
                throw new Error(message);
              }
              // 簡単にリロードして最新状態を反映
              window.location.reload();
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "エラーが発生しました";
              setErrorModal({
                title:
                  confirmTarget.action === "approve"
                    ? "参加申請の承認に失敗しました"
                    : "参加申請の見送りに失敗しました",
                message,
              });
            } finally {
              setConfirmProcessing(false);
            }
          }}
        />
      )}

      <ErrorModal
        open={Boolean(errorModal)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ""}
        message={errorModal?.message ?? ""}
      />
    </div>
  );
}
