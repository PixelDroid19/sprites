import "./styles.css";
import { createBlinkLab } from "./ui/blink-lab";
import { createSheet } from "./ui/sheet";
import { createStage } from "./ui/stage";

const mount = (id: string, el: HTMLElement) =>
  document.getElementById(id)?.replaceChildren(el);

mount("hoja", createSheet());
mount("escenario", createStage());
mount("reto", createBlinkLab());
