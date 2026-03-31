import { cn } from "@/lib/cn";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Controller,
  type FieldValues,
  type Path,
  useFormContext,
} from "react-hook-form";
import styles from "./GenericPicker.module.scss";

interface Item {
  id: number | string;
  name: string;
  image?: string | null;
}

interface GenericPickerProps<TFieldValues extends FieldValues> {
  selectedIdsFieldName: Path<TFieldValues>;
  newNamesFieldName?: Path<TFieldValues>; // 新規追加が許可されている場合のみ
  items: Item[];
  onChangeCallback?: () => void;
  placeholder?: string;
  maxItems?: number;
  allowCustom?: boolean; // 新規追加を許可するか（デフォルト: false）
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function GenericPicker<TFieldValues extends FieldValues>({
  selectedIdsFieldName,
  newNamesFieldName,
  items,
  onChangeCallback,
  placeholder = "検索...",
  maxItems = 5,
  allowCustom = false,
  anchorRef,
}: GenericPickerProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();

  if (allowCustom && !newNamesFieldName) {
    throw new Error(
      "GenericPicker: allowCustom が true の場合、newNamesFieldName は必須です",
    );
  }

  return (
    <Controller
      name={selectedIdsFieldName}
      control={control}
      render={({ field: selectedIdsField }) => (
        <>
          {allowCustom && newNamesFieldName ? (
            <Controller
              name={newNamesFieldName}
              control={control}
              render={({ field: newNamesField }) => (
                <GenericPickerBase
                  availableItems={items}
                  selectedItemIds={
                    Array.isArray(selectedIdsField.value)
                      ? selectedIdsField.value
                      : []
                  }
                  selectedNewNames={
                    Array.isArray(newNamesField.value)
                      ? newNamesField.value
                      : []
                  }
                  onChangeItemIds={(itemIds) => {
                    selectedIdsField.onChange(itemIds);
                    onChangeCallback?.();
                  }}
                  onChangeNewNames={(names) => {
                    newNamesField.onChange(names);
                    onChangeCallback?.();
                  }}
                  placeholder={placeholder}
                  maxItems={maxItems}
                  allowCustom={allowCustom}
                  anchorRef={anchorRef}
                />
              )}
            />
          ) : (
            <GenericPickerBase
              availableItems={items}
              selectedItemIds={
                Array.isArray(selectedIdsField.value)
                  ? selectedIdsField.value
                  : []
              }
              selectedNewNames={[]}
              onChangeItemIds={(itemIds) => {
                selectedIdsField.onChange(itemIds);
                onChangeCallback?.();
              }}
              onChangeNewNames={() => {}}
              placeholder={placeholder}
              maxItems={maxItems}
              allowCustom={allowCustom}
              anchorRef={anchorRef}
            />
          )}
        </>
      )}
    />
  );
}

interface GenericPickerBaseProps {
  availableItems: Item[];
  selectedItemIds: Array<number | string>;
  selectedNewNames: string[];
  onChangeItemIds: (itemIds: Array<number | string>) => void;
  onChangeNewNames: (names: string[]) => void;
  placeholder: string;
  // maxItems が指定されていない場合は上限なし
  maxItems?: number;
  allowCustom: boolean;
  // 選択済み扱いとして候補リストから除外したい項目
  hiddenItemIds?: Array<number | string>;
  // 外側の都合で完全に無効化したい場合
  isDisabled?: boolean;
  disabledPlaceholder?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function GenericPickerBase({
  availableItems: initialItems,
  selectedItemIds,
  selectedNewNames,
  onChangeItemIds,
  onChangeNewNames,
  placeholder,
  maxItems,
  allowCustom,
  hiddenItemIds,
  isDisabled,
  disabledPlaceholder,
  anchorRef,
}: GenericPickerBaseProps) {
  const [availableItems] = useState<Item[]>(initialItems);
  const [inputValue, setInputValue] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownToggleRef = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const { refs, floatingStyles, update } = useFloating({
    open: isMenuOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ],
  });

  useEffect(() => {
    if (anchorRef?.current) {
      refs.setReference(anchorRef.current);
      return;
    }

    if (dropdownToggleRef.current) {
      refs.setReference(dropdownToggleRef.current);
    }
  }, [anchorRef, refs]);

  useEffect(() => {
    const referenceEl = anchorRef?.current ?? dropdownToggleRef.current;
    if (!referenceEl) {
      setPortalRoot(null);
      return;
    }

    const dialogRoot = referenceEl.closest('[role="dialog"]');
    setPortalRoot(dialogRoot instanceof HTMLElement ? dialogRoot : null);
  }, [anchorRef]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const referenceEl = anchorRef?.current ?? dropdownToggleRef.current;
      const floatingEl = refs.floating.current;
      if (
        referenceEl &&
        !referenceEl.contains(target) &&
        floatingEl &&
        !floatingEl.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [anchorRef, refs.floating]);

  // 合計選択数を計算
  const totalCount = selectedItemIds.length + selectedNewNames.length;
  const hasLimit = typeof maxItems === "number" && Number.isFinite(maxItems);
  const isAtLimit =
    hasLimit && maxItems !== undefined && totalCount >= maxItems;

  const selectedItems = availableItems.filter((item) =>
    selectedItemIds.includes(item.id),
  );

  const addItem = async (item: Item) => {
    if (hasLimit && maxItems !== undefined && totalCount >= maxItems) return;

    if (!selectedItemIds.includes(item.id)) {
      onChangeItemIds([...selectedItemIds, item.id]);
      setInputValue("");
      setIsMenuOpen(false);
    }
  };

  const createAndAddItem = (name: string) => {
    const trimmedName = name.trim();
    if (
      !trimmedName ||
      (hasLimit && maxItems !== undefined && totalCount >= maxItems) ||
      !allowCustom
    ) {
      return;
    }

    // 新しい項目名を追加
    onChangeNewNames([...selectedNewNames, trimmedName]);
    setInputValue("");
    setIsMenuOpen(false);
  };

  const removeItem = (itemId: number | string) => {
    onChangeItemIds(selectedItemIds.filter((id) => id !== itemId));
  };

  const removeNewItem = (itemName: string) => {
    onChangeNewNames(selectedNewNames.filter((name) => name !== itemName));
  };

  const handleInput = (value: string) => {
    setInputValue(value);
    setIsMenuOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (isComposing) return;
      e.preventDefault();
      const query = inputValue.trim();
      if (query) {
        // 既存の項目か確認
        const existingItem = availableItems.find(
          (item) =>
            item.name.toLowerCase() === query.toLowerCase() &&
            !selectedItemIds.includes(item.id),
        );

        // 新規項目に既にあるか確認
        const isDuplicateNewItem = selectedNewNames.some(
          (name) => name.toLowerCase() === query.toLowerCase(),
        );

        if (existingItem) {
          addItem(existingItem);
        } else if (!isDuplicateNewItem && allowCustom) {
          // 新しい項目を作成
          createAndAddItem(query);
        }
      }
    } else if (e.key === "Escape") {
      setIsMenuOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleItemClick = (item: Item) => {
    if (pendingItem?.id === item.id) {
      addItem(item);
      setPendingItem(null);
    }
  };

  const handleCreateClick = () => {
    if (pendingItem?.id === -1) {
      createAndAddItem(inputValue.trim());
      setPendingItem(null);
    }
  };

  const selectedItemIdsSet = new Set(selectedItemIds);
  const hiddenItemIdsSet = new Set(hiddenItemIds ?? []);

  const filteredItems = availableItems.filter(
    (item) =>
      item.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedItemIdsSet.has(item.id) &&
      !hiddenItemIdsSet.has(item.id),
  );

  const showAddNew =
    allowCustom &&
    inputValue.trim() &&
    !availableItems.some(
      (item) => item.name.toLowerCase() === inputValue.trim().toLowerCase(),
    ) &&
    !selectedNewNames.some(
      (name) => name.toLowerCase() === inputValue.trim().toLowerCase(),
    );

  return (
    <div className={styles.container} ref={dropdownRef}>
      <div className={styles.dropdown}>
        {/* biome-ignore lint: divでのonClick使用を許可 */}
        <div
          ref={dropdownToggleRef}
          className={styles.dropdownToggle}
          onClick={() => {
            if (
              !isDisabled &&
              (!hasLimit || (maxItems !== undefined && totalCount < maxItems))
            ) {
              inputRef.current?.focus();
              setIsMenuOpen(true);
              update();
            }
          }}
        >
          <div className={styles.searchIcon} aria-hidden>
            <Image
              src="/images/search.png"
              width={1270}
              height={1270}
              alt="検索"
            />
          </div>
          <input
            ref={inputRef}
            className={styles.dropdownInput}
            placeholder={
              isDisabled && disabledPlaceholder
                ? disabledPlaceholder
                : hasLimit && maxItems !== undefined && totalCount >= maxItems
                  ? `これ以上追加できません (最大${maxItems}つ)`
                  : placeholder
            }
            value={inputValue}
            disabled={isDisabled || isAtLimit}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => {
              if (!isDisabled) {
                setIsMenuOpen(true);
                update();
              }
            }}
            onBlur={() => setIsMenuOpen(false)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            autoComplete="off"
          />
        </div>

        {isMenuOpen && (
          <FloatingPortal root={portalRoot ?? undefined}>
            <div
              ref={refs.setFloating}
              className={styles.dropdownMenu}
              role="listbox"
              style={floatingStyles}
            >
              <div className={styles.dropdownScroll}>
                <div className={styles.dropdownList}>
                  {filteredItems.length === 0 && !showAddNew && (
                    <div className={styles.dropdownItem}>
                      {inputValue.trim() === ""
                        ? "選べる項目がありません"
                        : selectedItemIdsSet.has(
                              availableItems.find(
                                (item) =>
                                  item.name.toLowerCase() ===
                                  inputValue.trim().toLowerCase(),
                              )?.id || -1,
                            )
                          ? `"${inputValue.trim()}" は既に選択されています`
                          : "項目が見つかりません"}
                    </div>
                  )}

                  {filteredItems.map((item, index) => (
                    // biome-ignore lint: divでのonClick使用を許可
                    <div
                      key={`available-${Number.isFinite(item.id) ? item.id : "no-id"}-${item.name}-${index}`}
                      className={styles.dropdownItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPendingItem(item);
                      }}
                      onClick={() => handleItemClick(item)}
                      role="option"
                      aria-selected="false"
                    >
                      {item.image && (
                        <span className={styles.dropdownAvatar}>
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={20}
                            height={20}
                          />
                        </span>
                      )}
                      <span>{item.name}</span>
                    </div>
                  ))}

                  {showAddNew && (
                    // biome-ignore lint: divでのonClick使用を許可
                    <div
                      className={cn(styles.dropdownItem, styles.addNew)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPendingItem({ id: -1, name: inputValue.trim() });
                      }}
                      onClick={handleCreateClick}
                      role="option"
                      aria-selected="false"
                    >
                      Enterで新しい項目を追加: &quot;{inputValue.trim()}&quot;
                    </div>
                  )}
                </div>
              </div>
            </div>
          </FloatingPortal>
        )}
      </div>

      {(selectedItems.length > 0 || selectedNewNames.length > 0) && (
        <div className={cn(styles.itemsContainer, styles.show)}>
          {selectedItems.map((item) => (
            <div key={`item-${item.id}`} className={styles.item}>
              <span className={styles.label}>{item.name}</span>
              {/* biome-ignore lint: spanでのonClick使用を許可 */}
              <span
                className={styles.remove}
                onClick={() => removeItem(item.id)}
                aria-label="削除"
              >
                ×
              </span>
            </div>
          ))}
          {selectedNewNames.map((itemName) => (
            <div key={`new-${itemName}`} className={styles.item}>
              <span className={styles.label}>{itemName}</span>
              {/* biome-ignore lint: spanでのonClick使用を許可 */}
              <span
                className={styles.remove}
                onClick={() => removeNewItem(itemName)}
                aria-label="削除"
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
