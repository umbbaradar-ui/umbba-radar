"use client";

// ============================================
// 로그인 직후 1회 — localStorage 데이터를 DB로 이관
// 같은 user에 대해선 1회만 실행 (sessionStorage 플래그)
// ============================================

import { useEffect } from "react";
import {
  listUserPostStatuses,
  clearAllLocal,
} from "../service";
import { migrateLocalStatusAction } from "../actions";

interface Props {
  userId: string | null;
}

export function MigrationOnLogin({ userId }: Props) {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const flagKey = `umbba-migrated:${userId}`;
    if (localStorage.getItem(flagKey)) return;

    const local = listUserPostStatuses();
    const count = Object.keys(local).length;

    if (count === 0) {
      localStorage.setItem(flagKey, "1");
      return;
    }

    migrateLocalStatusAction(local).then((result) => {
      if (result.ok) {
        localStorage.setItem(flagKey, "1");
        // 마이그레이션 완료 — 로컬 데이터 삭제
        clearAllLocal();
      }
    });
  }, [userId]);

  return null;
}
