import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SharedUser } from "../types";

export function MultiSearchableSelect({
  value,
  onChange,
  options,
  placeholder = "搜尋或輸入姓名",
  loading = false
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: SharedUser[];
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputId = useId().replace(/:/g, "");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (q
      ? options.filter(
          (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
      : options
    ).filter((u) => !value.includes(u.name));
    return rows.slice(0, 60);
  }, [options, query, value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(user: SharedUser) {
    onChange([...value, user.name]);
    setQuery("");
    inputRef.current?.focus();
  }

  function handleRemove(name: string) {
    onChange(value.filter((n) => n !== name));
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-col gap-[3px]">
        {value.map((name) => (
          <div key={name} className="flex items-center gap-1 text-[13px]">
            <span className="flex-1 text-left">{name}</span>
            <button
              type="button"
              onClick={() => handleRemove(name)}
              className="text-[#aaa] hover:text-[#c00] text-[14px] leading-none border-none bg-transparent cursor-pointer p-0 ml-1 flex-shrink-0"
              title="移除"
            >
              ×
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="search"
          name={`multi-member-picker-${inputId}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? "載入中…" : value.length === 0 ? placeholder : "再新增…"}
          className={INPUT_CLS}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
        />
      </div>
      {open && (
        <ul className="absolute z-50 left-0 top-full mt-0.5 min-w-[320px] max-w-[420px] w-max max-h-[220px] overflow-y-auto overflow-x-hidden bg-white border border-[#c8d0df] rounded-md shadow-lg list-none m-0 p-0">
          {filtered.length === 0 && (
            <li className="py-2 px-3 text-[12px] leading-5 text-[#999] whitespace-nowrap">
              {loading ? "載入中…" : "無符合結果"}
            </li>
          )}
          {filtered.map((user) => (
            <li
              key={user.email}
              className="py-1.5 px-3 text-[12px] leading-5 cursor-pointer whitespace-nowrap hover:bg-[#eef6ff] transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(user)}
              title={`${user.name} (${user.email})`}
            >
              <span className="inline-block align-middle max-w-[150px] truncate font-medium">
                {user.name}
              </span>
              <span className="inline-block align-middle max-w-[220px] truncate text-[#777] ml-1.5">
                {user.email}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INPUT_CLS =
  "w-full border-0 border-b border-b-[#aaa] bg-transparent font-[inherit] text-[13px] py-[2px] px-1 outline-none transition-colors focus:border-b-[#0a66c2] focus:bg-[#f0f6ff]";

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "搜尋或輸入姓名",
  loading = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: SharedUser[];
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputId = useId().replace(/:/g, "");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? options.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      : options;
    return rows.slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    if (!open) setOpen(true);
  }

  function handleSelect(user: SharedUser) {
    onChange(user.name);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleFocus() {
    setQuery("");
    setOpen(true);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="search"
        name={`member-picker-${inputId}`}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={loading ? "載入中…" : placeholder}
        className={INPUT_CLS}
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
      />
      {open && (
        <ul className="absolute z-50 left-0 top-full mt-0.5 min-w-[320px] max-w-[420px] w-max max-h-[220px] overflow-y-auto overflow-x-hidden bg-white border border-[#c8d0df] rounded-md shadow-lg list-none m-0 p-0">
          {filtered.length === 0 && (
            <li className="py-2 px-3 text-[12px] leading-5 text-[#999] whitespace-nowrap">
              {loading ? "載入中…" : "無符合結果"}
            </li>
          )}
          {filtered.map((user) => (
            <li
              key={user.email}
              className="py-1.5 px-3 text-[12px] leading-5 cursor-pointer whitespace-nowrap hover:bg-[#eef6ff] transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(user)}
              title={`${user.name} (${user.email})`}
            >
              <span className="inline-block align-middle max-w-[150px] truncate font-medium">
                {user.name}
              </span>
              <span className="inline-block align-middle max-w-[220px] truncate text-[#777] ml-1.5">
                {user.email}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
