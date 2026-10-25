// Default wiring for the board and metrics routes (NL-54).
import { with_route } from "../http/with-route.ts";
import { getServices } from "../container.ts";
import { make_board_handlers, type BoardApi } from "./board-routes.ts";

export const board_handlers = make_board_handlers({
  with_route,
  board: () => getServices().board as unknown as BoardApi,
});
