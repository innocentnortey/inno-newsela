// IA section 4: unitKey "g6-u4" <-> id "G6.U4"; lessonKey "L4" or flex "F1".."F9" <-> id "G6.U4.L4".
const UNIT_KEY = /^g(\d{1,2})-u(\d{1,2})$/;
const UNIT_ID = /^G(\d{1,2})\.U(\d{1,2})$/;
const LESSON_KEY = /^(?:L(?:[1-9]\d?)|F[1-9])$/;
const LESSON_ID = /^G\d{1,2}\.U\d{1,2}\.((?:L[1-9]\d?)|(?:F[1-9]))$/;

export function unitIdFromKey(unitKey: string): string | null {
  const m = UNIT_KEY.exec(unitKey);
  return m ? `G${m[1]}.U${m[2]}` : null;
}

export function unitKeyFromId(unitId: string): string | null {
  const m = UNIT_ID.exec(unitId);
  return m ? `g${m[1]}-u${m[2]}` : null;
}

export function lessonIdFromKey(unitKey: string, lessonKey: string): string | null {
  const unitId = unitIdFromKey(unitKey);
  if (!unitId || !LESSON_KEY.test(lessonKey)) return null;
  return `${unitId}.${lessonKey}`;
}

export function lessonKeyFromId(lessonId: string): string | null {
  const m = LESSON_ID.exec(lessonId);
  return m?.[1] ?? null;
}
