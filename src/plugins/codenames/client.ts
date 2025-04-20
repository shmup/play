import { defineClientPlugin } from "../framework/client.ts";
import { ClientMessage, ServerMessage } from "../../types/shared.ts";
import {
  CODENAMES_LAYER,
  CODENAMES_PLUGIN_ID,
  CODENAMES_PRIORITY,
  CodenamesCard,
  CodenamesClientMessageData,
  CodenamesPluginState,
  TeamColor,
} from "./shared.ts";
import { PluginContext } from "../../types/plugin.ts";

export const CodenamesPlugin = defineClientPlugin({
  id: CODENAMES_PLUGIN_ID,
  priority: CODENAMES_PRIORITY,

  onInit(context) {
    // Create the codenames layer
    context.canvasManager.getLayer(CODENAMES_LAYER, 50);

    // Initialize state
    context.setState((state) => {
      if (!state.codenames) {
        state.codenames = {
          gameActive: false,
          cards: [],
          currentTurn: "red",
          redScore: 0,
          blueScore: 0,
          winner: null,
          players: {},
        };
      }
    });

    // Add event listeners for the game
    const canvas = context.canvasManager.getMainCanvas();

    canvas.addEventListener("click", (e) => {
      const state = context.getState() as { codenames?: CodenamesPluginState };
      if (!state.codenames || !state.codenames.gameActive) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert screen coordinates to world coordinates
      const worldPos = context.canvasManager.screenToWorld(x, y);

      // Check if a card was clicked
      const clickedCard = findClickedCard(
        worldPos.x,
        worldPos.y,
        state.codenames.cards,
      );
      if (clickedCard) {
        // Only operatives can reveal cards and only on their team's turn
        const player = state.codenames.players[context.clientId];
        if (
          player &&
          player.role === "operative" &&
          player.team === state.codenames.currentTurn &&
          !clickedCard.revealed
        ) {
          context.sendMessage({
            type: CODENAMES_PLUGIN_ID,
            data: {
              action: "reveal",
              cardId: clickedCard.id,
            } as CodenamesClientMessageData,
          });
        }
      }
    });

    // Add UI controls
    this.setupUI(context);
  },

  onMessage(message: ServerMessage, context) {
    if (message.type !== CODENAMES_PLUGIN_ID) return;

    const gameState = message.data.gameState as CodenamesPluginState;

    context.setState((state) => {
      state.codenames = gameState;
    });

    context.markLayerDirty(CODENAMES_LAYER);
  },

  onBeforeRender(context) {
    return [CODENAMES_LAYER];
  },

  onRenderLayer(layerId, ctx, context) {
    if (layerId !== CODENAMES_LAYER) return;

    const state = context.getState() as { codenames?: CodenamesPluginState };
    if (!state.codenames) return;

    const {
      gameActive,
      cards,
      currentTurn,
      redScore,
      blueScore,
      winner,
      players,
    } = state.codenames;

    // Clear the layer
    const dimensions = context.canvasManager.getDimensions();
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw game status
    this.drawGameStatus(
      ctx,
      context,
      gameActive,
      currentTurn,
      redScore,
      blueScore,
      winner,
    );

    // Draw the cards
    if (cards.length > 0) {
      const viewport = context.canvasManager.getViewport();

      // Draw each card that's in the viewport
      for (const card of cards) {
        const screenPos = context.canvasManager.worldToScreen(card.x, card.y);

        // Check if card is in viewport
        if (
          screenPos.x + 150 >= 0 &&
          screenPos.x <= dimensions.width &&
          screenPos.y + 100 >= 0 &&
          screenPos.y <= dimensions.height
        ) {
          this.drawCard(
            ctx,
            card,
            screenPos.x,
            screenPos.y,
            players[context.clientId]?.role === "spymaster",
          );
        }
      }
    }
  },

  setupUI(context: PluginContext) {
    // Create UI container
    const uiContainer = document.createElement("div");
    uiContainer.style.position = "fixed";
    uiContainer.style.top = "10px";
    uiContainer.style.right = "10px";
    uiContainer.style.zIndex = "1000";
    uiContainer.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    uiContainer.style.padding = "10px";
    uiContainer.style.borderRadius = "5px";
    uiContainer.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.2)";

    // Game controls
    const gameControls = document.createElement("div");

    // Start/Stop button
    const startStopBtn = document.createElement("button");
    startStopBtn.textContent = "Start Game";
    startStopBtn.style.marginRight = "10px";
    startStopBtn.addEventListener("click", () => {
      const state = context.getState() as { codenames?: CodenamesPluginState };
      if (!state.codenames) return;

      const action = state.codenames.gameActive ? "stop" : "start";
      context.sendMessage({
        type: CODENAMES_PLUGIN_ID,
        data: {
          action,
        } as CodenamesClientMessageData,
      });
    });

    // Team selection
    const teamSelect = document.createElement("select");
    teamSelect.innerHTML = `
      <option value="red">Red Team</option>
      <option value="blue">Blue Team</option>
      <option value="spectator">Spectator</option>
    `;
    teamSelect.style.marginRight = "10px";

    // Role selection
    const roleSelect = document.createElement("select");
    roleSelect.innerHTML = `
      <option value="operative">Operative</option>
      <option value="spymaster">Spymaster</option>
    `;
    roleSelect.style.marginRight = "10px";

    // Join button
    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join";
    joinBtn.addEventListener("click", () => {
      const team = teamSelect.value as TeamColor | "spectator";
      const role = roleSelect.value as "spymaster" | "operative";

      context.sendMessage({
        type: CODENAMES_PLUGIN_ID,
        data: {
          action: "join",
          team: team === "spectator" ? null : team as TeamColor,
          role,
        } as CodenamesClientMessageData,
      });
    });

    // End turn button
    const endTurnBtn = document.createElement("button");
    endTurnBtn.textContent = "End Turn";
    endTurnBtn.style.marginTop = "10px";
    endTurnBtn.addEventListener("click", () => {
      context.sendMessage({
        type: CODENAMES_PLUGIN_ID,
        data: {
          action: "endTurn",
        } as CodenamesClientMessageData,
      });
    });

    // Add elements to the UI
    gameControls.appendChild(startStopBtn);
    gameControls.appendChild(teamSelect);
    gameControls.appendChild(roleSelect);
    gameControls.appendChild(joinBtn);
    gameControls.appendChild(document.createElement("br"));
    gameControls.appendChild(endTurnBtn);

    uiContainer.appendChild(gameControls);
    document.body.appendChild(uiContainer);

    // Update UI based on game state
    setInterval(() => {
      const state = context.getState() as { codenames?: CodenamesPluginState };
      if (!state.codenames) return;

      startStopBtn.textContent = state.codenames.gameActive
        ? "Stop Game"
        : "Start Game";

      // Disable/enable controls based on game state
      teamSelect.disabled = state.codenames.gameActive;
      roleSelect.disabled = state.codenames.gameActive;
      joinBtn.disabled = state.codenames.gameActive;

      // Only show end turn button for operatives on their team's turn
      const player = state.codenames.players[context.clientId];
      endTurnBtn.style.display = (
          state.codenames.gameActive &&
          player &&
          player.role === "operative" &&
          player.team === state.codenames.currentTurn
        )
        ? "block"
        : "none";
    }, 100);
  },

  drawGameStatus(
    ctx: CanvasRenderingContext2D,
    context: PluginContext,
    gameActive: boolean,
    currentTurn: TeamColor,
    redScore: number,
    blueScore: number,
    winner: TeamColor | null,
  ) {
    const dimensions = context.canvasManager.getDimensions();

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, dimensions.width, 40);

    ctx.font = "20px Arial";
    ctx.textAlign = "center";

    if (!gameActive) {
      ctx.fillStyle = "white";
      ctx.fillText("Codenames - Game not started", dimensions.width / 2, 28);
    } else if (winner) {
      ctx.fillStyle = winner === "red" ? "#ff6666" : "#6666ff";
      ctx.fillText(
        `${winner.toUpperCase()} TEAM WINS! (Red: ${redScore}, Blue: ${blueScore})`,
        dimensions.width / 2,
        28,
      );
    } else {
      ctx.fillStyle = "white";
      ctx.fillText(
        `Red: ${redScore} | Blue: ${blueScore} | Current Turn: ${currentTurn.toUpperCase()}`,
        dimensions.width / 2,
        28,
      );
    }

    ctx.restore();
  },

  drawCard(
    ctx: CanvasRenderingContext2D,
    card: CodenamesCard,
    x: number,
    y: number,
    isSpymaster: boolean,
  ) {
    const width = 140;
    const height = 90;

    ctx.save();

    // Card background
    if (card.revealed) {
      // Revealed card shows its team color
      switch (card.team) {
        case "red":
          ctx.fillStyle = "#ff6666";
          break;
        case "blue":
          ctx.fillStyle = "#6666ff";
          break;
        case "neutral":
          ctx.fillStyle = "#ddddcc";
          break;
        case "assassin":
          ctx.fillStyle = "#333333";
          break;
      }
    } else if (isSpymaster) {
      // Spymaster sees unrevealed cards with a hint of their team color
      switch (card.team) {
        case "red":
          ctx.fillStyle = "#ffdddd";
          break;
        case "blue":
          ctx.fillStyle = "#ddddff";
          break;
        case "neutral":
          ctx.fillStyle = "#eeeeee";
          break;
        case "assassin":
          ctx.fillStyle = "#dddddd";
          break;
      }
    } else {
      // Regular players see unrevealed cards as neutral
      ctx.fillStyle = "#eeeeee";
    }

    // Draw card with rounded corners
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();

    // Card border
    ctx.strokeStyle = card.revealed ? "#333333" : "#999999";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Card text
    ctx.fillStyle = card.revealed && card.team === "assassin"
      ? "#ffffff"
      : "#000000";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.word, x + width / 2, y + height / 2);

    // Spymaster indicators
    if (isSpymaster && !card.revealed) {
      // Draw a small indicator in the corner for spymasters
      ctx.fillStyle = card.team === "red"
        ? "#ff0000"
        : card.team === "blue"
        ? "#0000ff"
        : card.team === "assassin"
        ? "#000000"
        : "#999999";
      ctx.beginPath();
      ctx.arc(x + width - 10, y + 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
});

// Helper function to find a clicked card
function findClickedCard(
  x: number,
  y: number,
  cards: CodenamesCard[],
): CodenamesCard | null {
  for (const card of cards) {
    if (
      x >= card.x &&
      x <= card.x + 140 &&
      y >= card.y &&
      y <= card.y + 90
    ) {
      return card;
    }
  }
  return null;
}
