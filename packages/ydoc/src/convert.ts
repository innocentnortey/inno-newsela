import * as Y from "yjs";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import type { Section, StoredLesson } from "@ls/schema/lesson";
import {
  EDITOR_SCHEMA,
  SCHEMA_VERSION,
  SchemaUnknownError,
  assert_known_nodes,
  type ProseMirrorDoc,
} from "@ls/editor-schema/schema";

export type YDocBytes = Uint8Array;

const FIXED_CLIENT_ID = 1;

function check(content: ProseMirrorDoc, schema_version: number, lesson_id: string): void {
  try {
    assert_known_nodes(content, schema_version);
  } catch (e) {
    if (e instanceof SchemaUnknownError) throw e.with_lesson_id(lesson_id);
    throw e;
  }
}

/** Seed a Y.Doc from a stored lesson. Deterministic: fixed client id, one transaction. */
export function lesson_to_ydoc(lesson: StoredLesson): YDocBytes {
  for (const s of lesson.sections) {
    check(s.content as unknown as ProseMirrorDoc, lesson.schema_version, lesson.lesson_id);
  }
  const doc = new Y.Doc();
  doc.clientID = FIXED_CLIENT_ID;
  doc.transact(() => {
    const fm = doc.getMap("front_matter");
    fm.set("lesson_id", lesson.lesson_id);
    fm.set("title", lesson.title);
    fm.set("type", lesson.type);
    fm.set("standards", lesson.front_matter.standards);
    fm.set("vocabulary", lesson.front_matter.vocabulary);
    fm.set("minutes_total", lesson.front_matter.minutes_total);
    fm.set("text_cards", lesson.text_cards);
    fm.set("schema_version", lesson.schema_version);
    doc.getArray<string>("section_order").push(lesson.sections.map((s) => s.address));
    const meta = doc.getMap("section_meta");
    for (const s of lesson.sections) meta.set(s.address, { name: s.name, minutes: s.minutes });
    for (const s of lesson.sections) {
      prosemirrorJSONToYXmlFragment(EDITOR_SCHEMA, s.content, doc.getXmlFragment("section:" + s.address));
    }
  });
  const bytes = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return bytes;
}

/** Rebuild a stored lesson from Y.Doc bytes. Refuses unknown nodes/marks/versions; returns nothing on throw. */
export function ydoc_to_lesson(data: YDocBytes, schema_version: number): StoredLesson {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, data);
    const fm = doc.getMap("front_matter");
    const lesson_id = fm.get("lesson_id") as string;
    if (fm.get("schema_version") !== schema_version || schema_version !== SCHEMA_VERSION) {
      throw new SchemaUnknownError({ lesson_id, schema_version, unknown_nodes: [] });
    }
    const order = doc.getArray<string>("section_order").toArray();
    const meta = doc.getMap("section_meta");
    const sections: Section[] = order.map((address) => {
      const json = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("section:" + address)) as ProseMirrorDoc;
      check(json, schema_version, lesson_id);
      const content = EDITOR_SCHEMA.nodeFromJSON(json).toJSON() as unknown as Section["content"];
      const m = meta.get(address) as { name: string; minutes: number };
      return { address, name: m.name, minutes: m.minutes, content };
    });
    return {
      lesson_id,
      schema_version: SCHEMA_VERSION,
      title: fm.get("title") as string,
      type: fm.get("type") as string,
      front_matter: {
        standards: fm.get("standards") as StoredLesson["front_matter"]["standards"],
        minutes_total: fm.get("minutes_total") as number,
        vocabulary: fm.get("vocabulary") as string[],
      },
      sections,
      text_cards: fm.get("text_cards") as StoredLesson["text_cards"],
    };
  } finally {
    doc.destroy();
  }
}
