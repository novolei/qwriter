import { fireEvent, screen } from "@testing-library/react";

export async function chooseOption(name: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), {
    key: "ArrowDown",
  });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
