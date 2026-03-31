"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useState } from "react";
import styles from "./Attachments.module.scss";

type Attachment = {
  id: number | string;
  url: string;
  type: string;
  name?: string | null;
  file?: File;
};

interface Props {
  attachments: Attachment[];
  isImageFile: (type: string, name?: string | null) => boolean;
  imageAttachments: Attachment[];
  handleRemove: (index: number) => void;
  handleMove: (activeIndex: number, overIndex: number) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  activeAttachment?: Attachment | null | undefined;
}

export default function Attachments({
  attachments,
  isImageFile,
  imageAttachments,
  handleRemove,
  handleMove,
  activeId,
  setActiveId,
  activeAttachment,
}: Props) {
  return (
    <>
      {attachments.length > 0 && (
        <div className={styles.attachmentsArea}>
          {/* 非画像ファイル - 順番固定、インデックスベースで削除 */}
          {attachments.map((att, index) =>
            !isImageFile(att.type, att.name) ? (
              <NonImageAttachment
                key={`${att.id}-${index}`}
                attachment={att}
                onRemove={() => handleRemove(index)}
              />
            ) : null,
          )}

          {/* 画像ファイル - ドラッグ&ドロップで並び替え可能 */}
          {imageAttachments.length > 0 && (
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={(e: DragStartEvent) => {
                setActiveId(String(e.active.id));
              }}
              onDragEnd={(e: DragEndEvent) => {
                const { active, over } = e;

                if (over && active.id !== over.id) {
                  const activeIndex = active.data.current?.sortable?.index;
                  const overIndex = over.data.current?.sortable?.index;

                  if (activeIndex !== undefined && overIndex !== undefined) {
                    const activeImageAtt = imageAttachments[activeIndex];
                    const overImageAtt = imageAttachments[overIndex];
                    const activeAttIndex = attachments.indexOf(activeImageAtt);
                    const overAttIndex = attachments.indexOf(overImageAtt);

                    if (activeAttIndex !== -1 && overAttIndex !== -1) {
                      handleMove(activeAttIndex, overAttIndex);
                    }
                  }
                }

                setActiveId(null);
              }}
            >
              <SortableContext
                items={imageAttachments.map((a) => String(a.id))}
                strategy={rectSortingStrategy}
              >
                <ul className={styles.imagePreviewList}>
                  {imageAttachments.map((att, idx) => {
                    const originalIndex = attachments.indexOf(att);
                    return (
                      <SortableImageItem
                        key={att.id}
                        id={String(att.id)}
                        attachment={att}
                        index={idx}
                        onRemove={() => handleRemove(originalIndex)}
                      />
                    );
                  })}
                </ul>
              </SortableContext>

              {/* drag overlay rendered in portal to avoid clipping */}
              {typeof document !== "undefined" && (
                <DragOverlay>
                  {activeId && activeAttachment ? (
                    <div className={styles.dragOverlay}>
                      <Image
                        src={activeAttachment.url}
                        alt={activeAttachment.name || "preview"}
                        fill
                        style={{ objectFit: "cover" }}
                      />
                      <div className={styles.imageNumber}>
                        <span className={styles.inner}>
                          {imageAttachments.findIndex(
                            (img) => img.id === activeAttachment.id,
                          ) + 1}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              )}
            </DndContext>
          )}
        </div>
      )}
    </>
  );
}

// 非画像ファイルコンポーネント
interface NonImageAttachmentProps {
  attachment: Attachment;
  onRemove: () => void;
}

function NonImageAttachment({ attachment, onRemove }: NonImageAttachmentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const icon = getFileIcon(attachment.type, attachment.name);

  return (
    <fieldset
      className={styles.nonImageFile}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.fileIcon}>{icon}</div>
      <div className={styles.fileInfo}>
        <div className={styles.fileName}>{attachment.name || "ファイル"}</div>
        <div className={styles.fileType}>
          {attachment.name?.split(".").pop()?.toUpperCase() || attachment.type}
        </div>
      </div>
      {isHovered && (
        <button
          type="button"
          className={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </fieldset>
  );
}

// 画像ファイルコンポーネント（ドラッグ可能）
interface SortableImageItemProps {
  id: string;
  attachment: Attachment;
  index: number;
  onRemove: () => void;
}

function SortableImageItem({
  id,
  attachment,
  index,
  onRemove,
}: SortableImageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={styles.imagePreview}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{ width: "100%", height: "100%", position: "relative" }}
        {...listeners}
      >
        <Image
          src={attachment.url}
          alt={attachment.name || `画像${index + 1}`}
          fill
          style={{ objectFit: "cover" }}
        />
        <div className={styles.imageNumber}>
          <span className={styles.inner}>{index + 1}</span>
        </div>
      </div>
      {isHovered && (
        <button
          type="button"
          className={styles.removeBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </li>
  );
}

// getFileIcon helper (copied from parent file)
function getFileIcon(type: string, name?: string | null): string {
  if (type === "application/pdf") return "P";
  if (type.startsWith("text/")) return "T";
  if (type.startsWith("application/")) {
    if (type.includes("word") || type.includes("document")) return "W";
    if (type.includes("excel") || type.includes("spreadsheet")) return "X";
    if (type.includes("powerpoint") || type.includes("presentation"))
      return "S";
    if (type.includes("zip") || type.includes("compressed")) return "Z";
  }
  if (name) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "txt") return "T";
    if (ext === "pdf") return "P";
    if (ext === "doc" || ext === "docx") return "W";
    if (ext === "xls" || ext === "xlsx") return "X";
    if (ext === "ppt" || ext === "pptx") return "S";
    if (ext === "zip" || ext === "rar" || ext === "7z") return "Z";
  }
  return "F";
}
