import { defineClientPlugin } from "../framework/client.ts";
import type { PluginContext } from "../framework/client.ts";

const PLUGIN_ID = "momir";
const PLUGIN_PRIORITY = 11; // Between lobbies and contextmenu/chat/cursor

// Instanced only for lobby 2
interface MomirCardState {
  card: any | null;
  x: number;
  y: number;
  dragging: boolean;
  offsetX: number;
  offsetY: number;
}

export const MomirPlugin = defineClientPlugin({
  id: PLUGIN_ID,
  priority: PLUGIN_PRIORITY,

  onInit(context: PluginContext) {
    context.setState((state) => {
      if (!(state as any).momir) {
        (state as any).momir = {
          card: null,
          x: 200,
          y: 120,
          dragging: false,
          offsetX: 0,
          offsetY: 0,
        };
      }
    });

    // Only render context menu for lobby 2!
    if (typeof document.addEventListener === "function") {
      let menuEl: HTMLDivElement | null = null;
      let visible = false;
      document.addEventListener("contextmenu", (e) => {
        // Only pop menu for lobby 2 and only on main canvas
        const state = context.getState() as any;
        if (state.activeLobby !== 2) return;
        if (!(e.target instanceof HTMLCanvasElement)) return;
        e.preventDefault();
        if (menuEl) {
          menuEl.remove();
          menuEl = null;
          visible = false;
        }
        menuEl = document.createElement("div");
        menuEl.style.position = "fixed";
        menuEl.style.left = `${e.clientX}px`;
        menuEl.style.top = `${e.clientY}px`;
        menuEl.style.background = "#23243c";
        menuEl.style.color = "#fff";
        menuEl.style.zIndex = "9999";
        menuEl.style.padding = "5px 0";
        menuEl.style.borderRadius = "6px";
        menuEl.style.boxShadow = "0 5px 21px #000a";
        menuEl.style.minWidth = "140px";
        menuEl.style.cursor = "pointer";
        for (let i = 1; i <= 3; ++i) {
          const item = document.createElement("div");
          item.textContent = `CMC ${i}`;
          item.style.padding = "6px 18px";
          item.style.fontSize = "18px";
          item.style.fontWeight = "bold";
          item.onmouseover = () => (item.style.background = "#2352aa");
          item.onmouseout = () => (item.style.background = "#23243c");
          item.onclick = async () => {
            menuEl?.remove();
            menuEl = null;
            visible = false;
            // Generate card via scryfall momir
            const card = await fetch(`https://api.scryfall.com/cards/random?q=is:token+is:unique+cmc%3D${i}&format=json`).then(x=>x.json());
            context.setState((state) => {
              (state as any).momir.card = card;
            });
            context.forceRender();
          };
          menuEl.appendChild(item);
        }
        menuEl.oncontextmenu = (evt) => { evt.preventDefault(); };
        document.body.appendChild(menuEl);
        visible = true;
        // Dismiss when clicked elsewhere
        setTimeout(() => {
          const removeMenu = () => {
            menuEl?.remove();
            menuEl = null;
            visible = false;
            document.removeEventListener("mousedown", removeMenu);
          };
          document.addEventListener("mousedown", removeMenu, { once: true })
        }, 1);
      });

      // Drag logic for card
      document.addEventListener("mousedown", (e) => {
        const state = context.getState() as any;
        if (state.activeLobby !== 2) return;
        const m = state.momir as MomirCardState;
        if (m.card) {
          // Check if click within card area (estimate 300x410 region)
          const mx = e.clientX;
          const my = e.clientY;
          if (
            mx >= m.x && mx <= m.x + 300 &&
            my >= m.y && my <= m.y + 410
          ) {
            m.dragging = true;
            m.offsetX = mx - m.x;
            m.offsetY = my - m.y;
            context.setState((state) => {
              (state as any).momir = { ...m };
            });
          }
        }
      });
      document.addEventListener("mousemove", (e) => {
        const state = context.getState() as any;
        if (state.activeLobby !== 2) return;
        const m = state.momir as MomirCardState;
        if (m.card && m.dragging) {
          m.x = e.clientX - m.offsetX;
          m.y = e.clientY - m.offsetY;
          context.setState((state) => {
            (state as any).momir = { ...m };
          });
          context.forceRender();
        }
      });
      document.addEventListener("mouseup", (e) => {
        const state = context.getState() as any;
        if (state.activeLobby !== 2) return;
        const m = state.momir as MomirCardState;
        if (m.card && m.dragging) {
          m.dragging = false;
          context.setState((state) => {
            (state as any).momir = { ...m };
          });
          context.forceRender();
        }
      });
    }
  },

  onRenderLayer(_layerId, ctx: CanvasRenderingContext2D, context: PluginContext) {
    const state = context.getState() as any;
    if (state.activeLobby !== 2) return;
    const m = state.momir as MomirCardState;
    if (!m.card) return;
    // Draw card image (use card.image_uris.normal or .png)
    if (m.card.image_uris && m.card.image_uris.normal) {
      if (!m.card._imgObj) {
        const img = new Image();
        img.src = m.card.image_uris.normal;
        img.onload = () => context.forceRender();
        m.card._imgObj = img;
      }
      if (m.card._imgObj.complete) {
        ctx.drawImage(m.card._imgObj, m.x, m.y, 300, 410);
      } else {
        ctx.fillStyle = "#234";
        ctx.fillRect(m.x, m.y, 300, 410);
        ctx.fillStyle = "#fff";
        ctx.font = "20px sans-serif";
        ctx.fillText("Loading...", m.x + 30, m.y + 210);
      }
    } else {
      // fallback: just draw a box
      ctx.fillStyle = "#234";
      ctx.fillRect(m.x, m.y, 300, 410);
      ctx.fillStyle = "#fff";
      ctx.font = "18px sans-serif";
      ctx.fillText("No image", m.x + 36, m.y + 210);
    }
    // Draw card name overlay
    if (m.card.name) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.fillRect(m.x, m.y, 300, 38);
      ctx.font = "20px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(m.card.name, m.x + 12, m.y + 27);
      ctx.restore();
    }
  },

  onBeforeRender(context: PluginContext): string[] {
    // Always overlay on MAIN layer
    return ["main"];
  },
});
