"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

type Lesson = components["schemas"]["Lesson"];

export async function readFreshLesson(lessonId: string): Promise<Lesson> {
  const { data } = await api.GET("/lessons/{lessonId}", { params: { path: { lessonId } } });
  return data as Lesson;
}

export function useLessonContext(lessonId: string): { lesson: Lesson | null; state: "loading" | "ready" | "failed" } {
  const [res, setRes] = useState<{ lesson: Lesson | null; state: "loading" | "ready" | "failed" }>({ lesson: null, state: "loading" });
  useEffect(() => {
    let alive = true;
    readFreshLesson(lessonId).then(
      (lesson) => alive && setRes(lesson ? { lesson, state: "ready" } : { lesson: null, state: "failed" }),
      () => alive && setRes({ lesson: null, state: "failed" }),
    );
    return () => {
      alive = false;
    };
  }, [lessonId]);
  return res;
}
