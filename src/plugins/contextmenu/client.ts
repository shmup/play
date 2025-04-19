import { defineClientPlugin } from "../framework/client.ts";
import type { PluginContext } from "../framework/client.ts";
import { PLUGIN_ID, PLUGIN_PRIORITY, ContextMenuOption } from "./shared.ts";
import type { ContextMenuPluginState } from "./shared.ts";

// Default menu options for demonstration
const DEFAULT_OPTIONS: ContextMenuOption[] = [
  { label: "Action 1", value: "action1" },
  { label: "Action 2", value: "action2" },
  { label: "Action 3", value: "action3" },
];

/**
 * Factory to create a context menu plugin with custom options.
 * @param options Array of ContextMenuOption defining menu entries and optional handlers.
 */
export function createContextMenuPlugin(options: ContextMenuOption[] = DEFAULT_OPTIONS) {
  return defineClientPlugin({
    id: PLUGIN_ID,
    priority: PLUGIN_PRIORITY,
    onInit(context: PluginContext) {
      context.setState((state) => {
        // Initialize context menu state with provided options
        (state as { contextMenu?: ContextMenuPluginState }).contextMenu = {
          visible: false,
          x: 0,
          y: 0,
          options,
        };
      });

    // Create menu overlay
    const menu = document.createElement("div");
    menu.id = "context-menu-overlay";
    menu.style.position = "fixed";
    menu.style.display = "none";
    menu.style.zIndex = "9999";
    menu.style.background = "rgba(32,32,45,0.98)";
    menu.style.boxShadow = "0px 6px 24px rgba(0,0,0,0.3)";
    menu.style.borderRadius = "8px";
    menu.style.padding = "6px 0";
    menu.style.fontFamily = "system-ui,sans-serif";
    menu.style.fontSize = "16px";
    menu.style.minWidth = "180px";
    menu.style.maxWidth = "280px";
    menu.style.color = "#fafbfc";
    menu.style.transition = "opacity .12s ease";
    menu.style.userSelect = "none";
    menu.style.cursor = "default";
    menu.tabIndex = -1;
    document.body.appendChild(menu);

    function renderMenu(opts: ContextMenuOption[], x: number, y: number) {
      menu.innerHTML = "";
      opts.forEach((opt) => {
        const item = document.createElement("div");
        item.textContent = opt.label;
        item.style.padding = "8px 22px";
        item.style.cursor = "pointer";
        item.style.border = "none";
        item.style.outline = "none";
        item.onmouseover = () => (item.style.background = "rgba(255,255,255,0.09)");
        item.onmouseout = () => (item.style.background = "transparent");
        item.onclick = (e) => {
          e.stopPropagation();
          hideMenu();
          // Invoke custom handler if provided, otherwise log value
          if (typeof opt.onClick === 'function') {
            opt.onClick(context, opt, e);
          } else {
            console.log(`[contextmenu] selected:`, opt.value);
          }
        };
        menu.appendChild(item);
      });

      menu.oncontextmenu = (e) => {
        // Prevent new context menus spawning if menu is open
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      // Position within viewport bounds
      const { innerWidth, innerHeight } = globalThis;
      menu.style.left = "0px";
      menu.style.top = "0px";
      menu.style.visibility = "hidden";
      menu.style.display = "block";
      const rect = menu.getBoundingClientRect();
      let finalX = x;
      let finalY = y;
      if (finalX + rect.width > innerWidth) {
        finalX = Math.max(0, innerWidth - rect.width - 6);
      }
      if (finalY + rect.height > innerHeight) {
        finalY = Math.max(0, innerHeight - rect.height - 6);
      }
      menu.style.left = `${finalX}px`;
      menu.style.top = `${finalY}px`;
      menu.style.visibility = "visible";
      menu.focus();
    }

    function hideMenu() {
      menu.style.display = "none";
      context.setState((state) => {
        if ((state as { contextMenu?: ContextMenuPluginState }).contextMenu) {
          (state as { contextMenu: ContextMenuPluginState }).contextMenu.visible = false;
        }
      });
    }

    // listen for right-click event (contextmenu)
    if (typeof document.addEventListener === "function") {
      document.addEventListener("contextmenu", (e) => {
        // Only allow this context menu for the main canvas or background
        if (!e.target) return;
        const t = e.target as HTMLElement;
        if (!t.closest("canvas")) return; // only show for canvas

        e.preventDefault();
        e.stopPropagation();
        const x = e.clientX;
        const y = e.clientY;
        context.setState((state) => {
          const cm = (state as { contextMenu: ContextMenuPluginState }).contextMenu;
          if (cm) {
            cm.visible = true;
            cm.x = x;
            cm.y = y;
            cm.options = options;
          }
        });
        renderMenu(options, x, y);
      });
      document.addEventListener("mousedown", (e) => {
        if (
          e.target === menu ||
          (e.target instanceof Node && menu.contains(e.target as Node))
        ) {
          return;
        }
        hideMenu();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          hideMenu();
        }
      });
      document.addEventListener("scroll", () => hideMenu(), true);
      globalThis.addEventListener("resize", () => hideMenu());
    }
  },

  // no-op for server messages; this is a local-only menu
  onMessage(_message, _context) {
    return true;
  },
});
}

// Default plugin instance with default options
export const ContextMenuPlugin = createContextMenuPlugin();
