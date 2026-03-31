import { type CSSProperties, useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BewtFormData } from "@/app/schemas/bewtSchema";
import { MAX_IMAGES } from "../constants";
import styles from "./AppImagesUploader.module.scss";
import Image from "next/image";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface AppImagesUploaderProps {
  onChangeCallback?: () => void;
}

export function AppImagesUploader({
  onChangeCallback,
}: AppImagesUploaderProps = {}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<BewtFormData>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "images",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const remaining = MAX_IMAGES - fields.length;
    const files = Array.from(fileList).slice(0, remaining);

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      append({ file });
      onChangeCallback?.();
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    remove(index);
    onChangeCallback?.();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeIndex = active.data.current?.sortable?.index;
      const overIndex = over.data.current?.sortable?.index;

      if (activeIndex !== undefined && overIndex !== undefined) {
        move(activeIndex, overIndex);
        onChangeCallback?.();
      }
    }

    setActiveId(null);
  };

  const activeField = fields.find((field) => field.id === activeId);
  const activeIndex = activeField ? fields.indexOf(activeField) : -1;

  return (
    <div className={styles.container}>
      {fields.length === 0 && (
        // biome-ignore lint: ドラッグ&ドロップをdivで実装
        <div
          className={cn(styles.imgsUploadCont, isDragging && styles.dragover)}
          onClick={handleAddClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          ここにドラッグ＆ドロップ、
          <br />
          またはクリックで画像を追加
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {fields.length > 0 && (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={rectSortingStrategy}
          >
            <div className={cn(styles.imagesWrapper, styles.show)}>
              {fields.map((field, idx) => (
                <SortableImageItem
                  key={field.id}
                  id={field.id}
                  file={field.file}
                  index={idx}
                  onRemove={() => handleRemove(idx)}
                />
              ))}

              {fields.length < MAX_IMAGES && (
                // biome-ignore lint: ドラッグ&ドロップをdivで実装
                <div
                  className={styles.addSlot}
                  onClick={handleAddClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  +
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              )}
            </div>
          </SortableContext>
          {fields.length > 0 &&
            createPortal(
              <DragOverlay>
                {activeId && activeField ? (
                  <div className={styles.dragOverlay}>
                    <Image
                      src={URL.createObjectURL(activeField.file)}
                      alt={`ドラッグ中の画像${activeIndex + 1}`}
                      fill
                    />
                    <div className={styles.imageNumber}>
                      <span className={styles.inner}>{activeIndex + 1}</span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      )}
    </div>
  );
}

interface SortableImageItemProps {
  id: string;
  file: File;
  index: number;
  onRemove: () => void;
}

function SortableImageItem({
  id,
  file,
  index,
  onRemove,
}: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // ドラッグ中は元の画像を非表示にする
    opacity: isDragging ? 0 : 1,
  };

  const src = URL.createObjectURL(file);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.imagePreview}
      {...attributes}
    >
      <div
        style={{ width: "100%", height: "100%", position: "relative" }}
        {...listeners}
      >
        <Image src={src} alt={`画像${index + 1}`} fill />
        <div className={styles.imageNumber}>
          <span className={styles.inner}>{index + 1}</span>
        </div>
        {index === 0 && (
          <div className={styles.thumbnailLabel}>
            <span className={styles.inner}>サムネイル</span>
          </div>
        )}
      </div>
      {/* biome-ignore lint: ドラッグ&ドロップをdivで実装 */}
      <div
        className={styles.removeBtn}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove();
        }}
      >
        ×
      </div>
    </div>
  );
}
