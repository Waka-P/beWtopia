"use client";

import { BewtsCapabilityPicker } from "@/app/(sidebar)/components/BewtsCapabilityPicker";
import { RolePicker } from "@/app/(sidebar)/components/RolePicker";
import SearchBar from "@/app/(sidebar)/components/SearchBar/SearchBar";
import Avatar from "@/components/Avatar";
import { ErrorModal } from "@/components/ErrorModal";
import type { BewtsCapability } from "@/generated/prisma/enums";
import { CAPABILITY_OPTIONS } from "@/lib/bewtsCapabilities";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import styles from "../Settings.module.scss";

type MemberPermission = {
  userId: number;
  publicId: string;
  name: string;
  image: string | null;
  capabilities: BewtsCapability[];
  roleIds: number[];
  roleNames: string[];
};

type RoleSetting = {
  roleId: number;
  roleName: string;
};

type Props = {
  projectPublicId: string;
  projectName: string;
  members: MemberPermission[];
  roles: RoleSetting[];
};

export default function MembersSettingsClient({
  projectPublicId,
  projectName: _projectName,
  members,
  roles,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(
    members[0]?.userId ?? null,
  );
  const [draftCapabilities, setDraftCapabilities] = useState<
    Record<number, BewtsCapability[]>
  >(
    () =>
      Object.fromEntries(
        members.map((member) => [member.userId, member.capabilities]),
      ) as Record<number, BewtsCapability[]>,
  );
  const [draftRoleIds, setDraftRoleIds] = useState<Record<number, number[]>>(
    () =>
      Object.fromEntries(
        members.map((member) => [member.userId, member.roleIds]),
      ) as Record<number, number[]>,
  );

  const [processingPermissionUserId, setProcessingPermissionUserId] = useState<
    number | null
  >(null);
  const [processingRoleUserId, setProcessingRoleUserId] = useState<
    number | null
  >(null);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const dirtyPermissionUserIds = useMemo(
    () =>
      members
        .filter((member) => {
          const next = draftCapabilities[member.userId] ?? [];
          const current = member.capabilities ?? [];
          if (next.length !== current.length) return true;
          return next.some((value) => !current.includes(value));
        })
        .map((member) => member.userId),
    [draftCapabilities, members],
  );

  const dirtyRoleUserIds = useMemo(
    () =>
      members
        .filter((member) => {
          const next = draftRoleIds[member.userId] ?? [];
          const current = member.roleIds ?? [];
          if (next.length !== current.length) return true;
          return next.some((value) => !current.includes(value));
        })
        .map((member) => member.userId),
    [draftRoleIds, members],
  );

  const selectedMember =
    members.find((member) => member.userId === selectedMemberId) ?? null;

  const toCapabilityText = useCallback((capabilities: BewtsCapability[]) => {
    const capabilityNames = capabilities
      .map(
        (capability) =>
          CAPABILITY_OPTIONS.find((option) => option.id === capability)?.name,
      )
      .filter((name): name is string => Boolean(name));
    return capabilityNames.join(" / ");
  }, []);

  const dirtyUserIdSet = useMemo(
    () => new Set([...dirtyPermissionUserIds, ...dirtyRoleUserIds]),
    [dirtyPermissionUserIds, dirtyRoleUserIds],
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;

    return members.filter((member) => {
      const roleText = roles
        .filter((role) =>
          (draftRoleIds[member.userId] ?? member.roleIds).includes(role.roleId),
        )
        .map((role) => role.roleName)
        .join(" ")
        .toLowerCase();
      const capabilityText = toCapabilityText(
        draftCapabilities[member.userId] ?? member.capabilities,
      ).toLowerCase();

      return (
        member.name.toLowerCase().includes(query) ||
        roleText.includes(query) ||
        capabilityText.includes(query)
      );
    });
  }, [
    draftCapabilities,
    draftRoleIds,
    members,
    roles,
    searchQuery,
    toCapabilityText,
  ]);

  const savePermission = async (member: MemberPermission) => {
    const nextCapabilities = draftCapabilities[member.userId] ?? [];
    const currentCapabilities = member.capabilities ?? [];
    if (
      nextCapabilities.length === currentCapabilities.length &&
      !nextCapabilities.some((value) => !currentCapabilities.includes(value))
    ) {
      return;
    }

    try {
      setProcessingPermissionUserId(member.userId);

      const res = await fetch(`/api/bewts/${projectPublicId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          capabilities: nextCapabilities,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data?.error as string | undefined) ?? "権限の更新に失敗しました",
        );
      }

      window.location.reload();
    } catch (error) {
      setErrorModal({
        title: "権限更新エラー",
        message:
          error instanceof Error ? error.message : "権限の更新に失敗しました",
      });
    } finally {
      setProcessingPermissionUserId(null);
    }
  };

  const saveRoleAssignment = async (member: MemberPermission) => {
    const nextRoleIds = draftRoleIds[member.userId] ?? [];
    const currentRoleIds = member.roleIds ?? [];
    if (
      nextRoleIds.length === currentRoleIds.length &&
      !nextRoleIds.some((value) => !currentRoleIds.includes(value))
    ) {
      return;
    }

    try {
      setProcessingRoleUserId(member.userId);

      const res = await fetch(`/api/bewts/${projectPublicId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          roleIds: nextRoleIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data?.error as string | undefined) ?? "役割の更新に失敗しました",
        );
      }

      window.location.reload();
    } catch (error) {
      setErrorModal({
        title: "役割更新エラー",
        message:
          error instanceof Error ? error.message : "役割の更新に失敗しました",
      });
    } finally {
      setProcessingRoleUserId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link
          href={`/bewts/${projectPublicId}/settings`}
          className={styles.trail}
        >
          <span className={styles.trailArrow}>&#9664;</span>
          設定メニューへ戻る
        </Link>
      </div>

      <section className={styles.section}>
        <h1 className={styles.title}>権限・役割設定</h1>
      </section>

      <section className={styles.section}>
        {members.length === 0 ? (
          <p className={styles.emptyText}>
            権限を変更できるメンバーはいません。
          </p>
        ) : (
          <div className={styles.membersEditorLayout}>
            <div className={styles.memberListPanel}>
              <div className={styles.memberListHeader}>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className={styles.memberSearchBar}
                  placeholder="メンバー名・役割・権限で検索"
                />
              </div>

              <div className={styles.memberList}>
                {filteredMembers.map((member) => {
                  const draftCaps =
                    draftCapabilities[member.userId] ?? member.capabilities;
                  const draftRoles =
                    draftRoleIds[member.userId] ?? member.roleIds;
                  const isSelected = member.userId === selectedMemberId;
                  const isDirty = dirtyUserIdSet.has(member.userId);

                  return (
                    <button
                      key={member.userId}
                      type="button"
                      className={cn(
                        styles.memberSelectableItem,
                        isSelected && styles.memberSelectableItemActive,
                      )}
                      onClick={() => setSelectedMemberId(member.userId)}
                    >
                      <div className={styles.memberMain}>
                        <Avatar src={member.image} alt={member.name} />
                        <div className={styles.memberInfo}>
                          <div className={styles.memberName}>{member.name}</div>
                          <div className={styles.memberMeta}>
                            {draftRoles.length > 0
                              ? `役割: ${roles
                                  .filter((role) =>
                                    draftRoles.includes(role.roleId),
                                  )
                                  .map((role) => role.roleName)
                                  .join(" / ")}`
                              : "役割なし"}
                          </div>
                          <div className={styles.memberMeta}>
                            権限: {toCapabilityText(draftCaps)}
                          </div>
                        </div>
                      </div>

                      <div className={styles.memberItemRight}>
                        {isDirty && (
                          <span className={styles.memberDirtyBadge}>
                            未保存
                          </span>
                        )}
                        {isSelected && (
                          <span className={styles.joinStatus}>編集中</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <p className={styles.emptyText}>
                    該当するメンバーが見つかりません。
                  </p>
                )}
              </div>
            </div>

            <div className={styles.memberEditPanel}>
              {!selectedMember ? (
                <p className={styles.emptyText}>
                  編集対象のメンバーを選択してください。
                </p>
              ) : (
                (() => {
                  const permissionProcessing =
                    processingPermissionUserId === selectedMember.userId;
                  const roleProcessing =
                    processingRoleUserId === selectedMember.userId;
                  const selectedDraftCapabilities =
                    draftCapabilities[selectedMember.userId] ??
                    selectedMember.capabilities;
                  const selectedDraftRoleIds =
                    draftRoleIds[selectedMember.userId] ??
                    selectedMember.roleIds;
                  const permissionDirty = dirtyPermissionUserIds.includes(
                    selectedMember.userId,
                  );
                  const roleDirty = dirtyRoleUserIds.includes(
                    selectedMember.userId,
                  );

                  return (
                    <div className={styles.memberItem}>
                      <div className={styles.memberMain}>
                        <Avatar
                          src={selectedMember.image}
                          alt={selectedMember.name}
                        />
                        <div className={styles.memberInfo}>
                          <div className={styles.memberName}>
                            {selectedMember.name}
                          </div>
                        </div>
                      </div>

                      <div className={styles.editFieldGroup}>
                        <div className={styles.fieldLabel}>
                          権限（複数選択）
                        </div>
                        <div className={styles.permissionControls}>
                          <BewtsCapabilityPicker
                            selectedCapabilities={selectedDraftCapabilities}
                            onChange={(capabilities) =>
                              setDraftCapabilities((prev) => ({
                                ...prev,
                                [selectedMember.userId]: capabilities,
                              }))
                            }
                            disabled={permissionProcessing}
                            placeholder="権限を選択"
                          />
                          <button
                            type="button"
                            className={styles.saveBtn}
                            disabled={!permissionDirty || permissionProcessing}
                            onClick={() => void savePermission(selectedMember)}
                          >
                            {permissionProcessing ? "更新中..." : "権限を保存"}
                          </button>
                        </div>
                      </div>

                      <div className={styles.editFieldGroup}>
                        <div className={styles.fieldLabel}>
                          役割（複数選択）
                        </div>
                        <div className={styles.permissionControls}>
                          <RolePicker
                            roles={roles.map((role) => ({
                              id: role.roleId,
                              name: role.roleName,
                            }))}
                            selectedRoleIds={selectedDraftRoleIds}
                            onChange={(roleIds) =>
                              setDraftRoleIds((prev) => ({
                                ...prev,
                                [selectedMember.userId]: roleIds,
                              }))
                            }
                            placeholder="役割を選択"
                            maxItems={roles.length}
                            disabled={roleProcessing}
                          />

                          <button
                            type="button"
                            className={styles.saveBtn}
                            disabled={!roleDirty || roleProcessing}
                            onClick={() =>
                              void saveRoleAssignment(selectedMember)
                            }
                          >
                            {roleProcessing ? "更新中..." : "役割を保存"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}
        {(dirtyPermissionUserIds.length > 0 || dirtyRoleUserIds.length > 0) && (
          <p className={styles.hint}>
            未保存の変更があります。メンバーごとに保存してください。
          </p>
        )}
      </section>

      <ErrorModal
        open={Boolean(errorModal)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ""}
        message={errorModal?.message ?? ""}
      />
    </div>
  );
}
