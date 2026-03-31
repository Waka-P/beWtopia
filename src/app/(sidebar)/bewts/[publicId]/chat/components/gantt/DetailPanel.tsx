import { GenericPickerBase } from "@/app/(sidebar)/components/GenericPicker";
import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import { ErrorModal } from "@/components/ErrorModal";
import { cn } from "@/lib/cn";
import { type CSSProperties, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa6";
import styles from "./GanttChart.module.scss";
import {
  ALL_ASSIGNEES_PICKER_ID,
  type AssigneeUser,
  type BewtsRole,
  computeHiddenUserIdsForPicker,
  type GanttTask,
  getBaseAssigneeIdsFromTask,
  mapAssigneeIdsToPickerItemIds,
  normalizeSegments,
  resolvePickerSelection,
  ROLE_ASSIGNEE_PICKER_PREFIX,
  STATUS_LABELS,
  TASK_COLORS,
} from "./ganttShared";

export function DetailPanel({
  task,
  onClose,
  onSave,
  onDelete,
  assigneeUsers,
  isAllRoom,
  roles,
  isVisible,
  onAnimationEnd,
}: {
  task: GanttTask;
  onClose: () => void;
  onSave: (
    updated: Partial<GanttTask> & { assigneeUserIds?: number[] },
  ) => Promise<void>;
  onDelete: () => void;
  assigneeUsers: AssigneeUser[];
  isAllRoom: boolean;
  roles: BewtsRole[];
  isVisible: boolean;
  onAnimationEnd: () => void;
}) {
  type DetailTab = "basic" | "period";

  const [activeTab, setActiveTab] = useState<DetailTab>("basic");
  const { tabbedRef, indicatorRef } = useTabIndicator<DetailTab>(activeTab);

  const [form, setForm] = useState({
    name: task.name,
    description: task.description ?? "",
    status: task.status,
    progress: task.progress,
    memo: task.memo ?? "",
    color: task.color ?? (null as string | null),
    segments: task.segments.map((s) => ({ ...s })),
  });
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>(() =>
    getBaseAssigneeIdsFromTask(task),
  );
  const [selectedPickerItemIds, setSelectedPickerItemIds] = useState<
    Array<number | string>
  >(() => {
    const baseAssigneeIds = getBaseAssigneeIdsFromTask(task);
    return mapAssigneeIdsToPickerItemIds(
      baseAssigneeIds,
      assigneeUsers,
      isAllRoom,
      roles,
    );
  });
  const [saving, setSaving] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  useEffect(() => {
    setForm({
      name: task.name,
      description: task.description ?? "",
      status: task.status,
      progress: task.progress,
      memo: task.memo ?? "",
      color: task.color ?? null,
      segments: task.segments.map((s) => ({ ...s })),
    });
    const baseAssigneeIds = getBaseAssigneeIdsFromTask(task);
    setSelectedAssigneeIds(baseAssigneeIds);
    setSelectedPickerItemIds(
      mapAssigneeIdsToPickerItemIds(
        baseAssigneeIds,
        assigneeUsers,
        isAllRoom,
        roles,
      ),
    );
  }, [task, assigneeUsers, isAllRoom, roles]);

  const handleSave = async () => {
    const normalized = normalizeSegments(form.segments);

    for (let i = 1; i < normalized.length; i += 1) {
      const prevEnd = new Date(normalized[i - 1].endAt).getTime();
      const curStart = new Date(normalized[i].startAt).getTime();
      if (curStart < prevEnd) {
        setActiveTab("period");
        setErrorModalOpen(true);
        return;
      }
    }

    setSaving(true);
    await onSave({
      name: form.name,
      description: form.description,
      status: form.status,
      progress: form.progress,
      memo: form.memo,
      color: form.color,
      assigneeUserIds: selectedAssigneeIds,
      segments: normalized,
    });
    setSaving(false);
  };

  const addSegment = () => {
    const last = form.segments[form.segments.length - 1];
    const startAt = last
      ? new Date(new Date(last.endAt).getTime() + 86_400_000).toISOString()
      : new Date().toISOString();
    const endAt = new Date(
      new Date(startAt).getTime() + 3 * 86_400_000,
    ).toISOString();
    setForm((f) => ({
      ...f,
      segments: [
        ...f.segments,
        {
          id: null,
          startAt,
          endAt,
          color: null,
          label: `期間 ${f.segments.length + 1}`,
          note: "",
          order: f.segments.length,
        },
      ],
    }));
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: パネル内クリックを親に伝搬させないため
    // biome-ignore lint/a11y/useKeyWithClickEvents: キーボード操作対象ではなく伝搬制御のみ
    <div
      className={cn(
        styles.detailPanel,
        isVisible ? styles.detailPanelEntering : styles.detailPanelExiting,
      )}
      onClick={(e) => e.stopPropagation()}
      onAnimationEnd={() => {
        if (!isVisible) {
          onAnimationEnd();
        }
      }}
    >
      <div className={styles.panelHeader}>
        <div className={styles.detailTabArea}>
          <div className={styles.detailTabTop}>
            <div ref={tabbedRef} className={styles.detailTabbed}>
              <div
                ref={indicatorRef}
                className={styles.detailTabbedIndicator}
              />

              <button
                type="button"
                className={cn(
                  styles.detailTabBtn,
                  activeTab === "basic" && styles.activeDetailTab,
                )}
                data-tab="basic"
                onClick={() => setActiveTab("basic")}
              >
                基本情報
              </button>
              <button
                type="button"
                className={cn(
                  styles.detailTabBtn,
                  activeTab === "period" && styles.activeDetailTab,
                )}
                data-tab="period"
                onClick={() => setActiveTab("period")}
              >
                実施期間
              </button>
            </div>
          </div>
        </div>
        <button type="button" className={styles.panelClose} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.panelBody}>
        <div
          className={styles.detailTabContainer}
          style={{
            transform:
              activeTab === "basic" ? "translateX(0)" : "translateX(-100%)",
          }}
        >
          <div
            className={cn(
              styles.detailTabContent,
              activeTab === "basic" && styles.detailTabContentActive,
            )}
          >
            <div className={styles.panelField}>
              <label className={styles.panelLabel} htmlFor="panel-name">
                タスク名
              </label>
              <input
                id="panel-name"
                className={styles.panelInput}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className={styles.panelField}>
              <label className={styles.panelLabel} htmlFor="panel-desc">
                説明
              </label>
              <textarea
                id="panel-desc"
                className={styles.panelTextarea}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className={styles.panelField}>
              <label className={styles.panelLabel} htmlFor="panel-status">
                ステータス
              </label>
              <div className={styles.statusChipRow} id="panel-status">
                {STATUS_LABELS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={cn(
                      styles.statusChipButton,
                      form.status === s && styles.statusChipButtonActive,
                    )}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        status: s,
                      }))
                    }
                  >
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.panelField}>
              <label className={styles.panelLabel} htmlFor="panel-progress">
                進捗{" "}
                <span style={{ color: "#00d4ff", fontFamily: "monospace" }}>
                  {form.progress}%
                </span>
              </label>
              <input
                id="panel-progress"
                className={styles.progressInput}
                type="range"
                min={0}
                max={100}
                value={form.progress}
                style={
                  {
                    "--progress": form.progress,
                  } as CSSProperties
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    progress: Number(e.target.value),
                  }))
                }
              />
            </div>

            <div className={styles.panelField}>
              <div className={styles.panelLabel}>担当者</div>
              {(() => {
                const isAllSelectedByAssignees = (() => {
                  const allUserIds = assigneeUsers.map((u) => u.id);
                  if (
                    allUserIds.length === 0 ||
                    selectedAssigneeIds.length !== allUserIds.length
                  ) {
                    return false;
                  }
                  return allUserIds.every((id) =>
                    selectedAssigneeIds.includes(id),
                  );
                })();

                const isAllSelectedForPicker =
                  selectedPickerItemIds.includes(ALL_ASSIGNEES_PICKER_ID) ||
                  isAllSelectedByAssignees;

                const hiddenUserIds = computeHiddenUserIdsForPicker(
                  selectedPickerItemIds,
                  assigneeUsers,
                  roles,
                );

                return (
                  <GenericPickerBase
                    availableItems={[
                      ...assigneeUsers.map((u) => ({
                        id: u.id,
                        name: u.name || "(名無し)",
                        image: u.image || "/images/user-icon-default.png",
                      })),
                      ...(assigneeUsers.length === 0
                        ? []
                        : [
                            {
                              id: ALL_ASSIGNEES_PICKER_ID,
                              name: "全員",
                            },
                          ]),
                      ...(!isAllRoom || isAllSelectedForPicker
                        ? []
                        : roles
                            .filter((r) => r.userIds.length > 0)
                            .map((r) => ({
                              id: `${ROLE_ASSIGNEE_PICKER_PREFIX}${r.id}`,
                              name: r.name,
                            }))),
                    ]}
                    selectedItemIds={selectedPickerItemIds}
                    selectedNewNames={[]}
                    hiddenItemIds={hiddenUserIds}
                    isDisabled={isAllSelectedForPicker}
                    disabledPlaceholder="全員選択済みです"
                    onChangeItemIds={(ids) => {
                      const incoming = ids as Array<number | string>;

                      const { nextPickerItemIds, assigneeUserIds } =
                        resolvePickerSelection(incoming, assigneeUsers, roles);

                      setSelectedPickerItemIds(nextPickerItemIds);
                      setSelectedAssigneeIds(assigneeUserIds);
                    }}
                    onChangeNewNames={() => {}}
                    placeholder="担当者を検索"
                    allowCustom={false}
                  />
                );
              })()}
            </div>

            <div className={styles.panelField}>
              <label className={styles.panelLabel} htmlFor="panel-memo">
                備考
              </label>
              <input
                id="panel-memo"
                className={styles.panelInput}
                value={form.memo}
                placeholder="備考を入力..."
                onChange={(e) =>
                  setForm((f) => ({ ...f, memo: e.target.value }))
                }
              />
            </div>

            <div className={styles.panelField}>
              <div className={styles.panelLabel}>バーカラー</div>
              <div className={styles.barColorSwatches}>
                {TASK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        color: f.color === c ? null : c,
                      }))
                    }
                    className={cn(
                      styles.barColorButton,
                      form.color === c && styles.barColorButtonSelected,
                    )}
                    style={{ background: c }}
                  />
                ))}
                <button
                  type="button"
                  title="デフォルト色"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      color: null,
                    }))
                  }
                  className={cn(
                    styles.barColorResetButton,
                    form.color === null && styles.barColorResetButtonActive,
                  )}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div
            className={cn(
              styles.detailTabContent,
              activeTab === "period" && styles.detailTabContentActive,
            )}
          >
            {form.segments.map((seg, idx) => (
              <div
                key={seg.id ?? `new-${seg.startAt}-${idx}`}
                className={styles.periodItem}
              >
                <div className={styles.periodItemHeader}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    <span className={styles.periodBadge}>期間 {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.periodRemove}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        segments: f.segments.filter((_, i) => i !== idx),
                      }))
                    }
                    disabled={form.segments.length <= 1}
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.periodFields}>
                  <div className={styles.pf}>
                    <div className={styles.pfLabel}>ラベル</div>
                    <input
                      className={styles.pfInput}
                      value={seg.label ?? ""}
                      placeholder="例：第1回"
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          segments: f.segments.map((s, i) =>
                            i === idx ? { ...s, label: e.target.value } : s,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className={styles.dateInputs}>
                    <div className={styles.pf}>
                      <div className={styles.pfLabel}>開始日時</div>
                      <input
                        className={cn(styles.pfInput, styles.pfInputDate)}
                        type="datetime-local"
                        value={seg.startAt ? seg.startAt.slice(0, 16) : ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            segments: f.segments.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    startAt: e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : s.startAt,
                                  }
                                : s,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className={styles.pf}>
                      <div className={styles.pfLabel}>終了日時</div>
                      <input
                        className={cn(styles.pfInput, styles.pfInputDate)}
                        type="datetime-local"
                        value={seg.endAt ? seg.endAt.slice(0, 16) : ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            segments: f.segments.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    endAt: e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : s.endAt,
                                  }
                                : s,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className={styles.addPeriodBtn}
              onClick={addSegment}
            >
              <FaPlus />
              期間を追加
            </button>
          </div>
        </div>
      </div>

      <div className={styles.panelActions}>
        <button
          type="button"
          className={styles.btnSave}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button type="button" className={styles.btnDelete} onClick={onDelete}>
          削除
        </button>
      </div>

      <ErrorModal
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="期間が重なっています"
        message="同じタスク内で期間が重なっています。時間を調整してください。"
      />
    </div>
  );
}
