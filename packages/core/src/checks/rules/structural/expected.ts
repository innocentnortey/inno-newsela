// Template table, duplicated on purpose from NL-18's SECTION_TEMPLATES (parallel ticket; no cross-ticket dependency).
export type ExpectedSection = {
  name: string;
  minutes: number;
  required_roles: string[];
};

// Section minutes may differ from the template by at most this (WP-1: a 3-minute Look Back vs 5 must flag).
export const SECTION_MINUTES_TOLERANCE = 1;

const ELD = ["eld_callout_purpose", "eld_callout_say", "eld_callout_watch"];
const WITH_CFU = [...ELD, "cfu"];

export function EXPECTED_SECTIONS(type: string): ExpectedSection[] | null {
  switch (type) {
    case "Reading":
    case "Writing":
    case "Academic Discussion":
    case "Research":
    case "Presentation":
      return [
        { name: "Launch", minutes: 5, required_roles: [] },
        { name: "Literacy Lab", minutes: 10, required_roles: [...ELD] },
        {
          name: "Learning in Action",
          minutes: 30,
          required_roles: [...WITH_CFU],
        },
        { name: "Look Back", minutes: 5, required_roles: [] },
        { name: "Homework", minutes: 0, required_roles: [] },
      ];
    case "Spark":
      return [
        { name: "Launch", minutes: 15, required_roles: [] },
        {
          name: "Learning in Action",
          minutes: 30,
          required_roles: [...WITH_CFU],
        },
        { name: "Look Back", minutes: 5, required_roles: [] },
        { name: "Homework", minutes: 0, required_roles: [] },
      ];
    default:
      if (type === "Flex Day" || type.includes("Assessment")) {
        return [
          { name: "Launch", minutes: 5, required_roles: [] },
          {
            name: "Learning in Action",
            minutes: 40,
            required_roles: [...WITH_CFU],
          },
          { name: "Look Back", minutes: 5, required_roles: [] },
        ];
      }
      return null;
  }
}

export function section_name_to_address(
  lesson_id: string,
  name: string,
): string {
  return `${lesson_id}.${name.replace(/\s+/g, "")}`;
}
