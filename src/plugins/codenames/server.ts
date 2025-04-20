import { ServerPlugin } from "../../types/server.ts";
import { ClientMessage } from "../../types/shared.ts";
import {
  CODENAMES_PLUGIN_ID,
  CODENAMES_WORDS,
  CodenamesCard,
  CodenamesClientMessageData,
  CodenamesPluginState,
  TeamColor,
} from "./shared.ts";

export const CodenamesServerPlugin: ServerPlugin = {
  id: CODENAMES_PLUGIN_ID,
  priority: 50,

  onInit(context) {
    // Initialize the game state
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
  },

  onClientConnect(clientId, context) {
    // Add the new client to the players list as a spectator
    context.setState((state) => {
      if (!state.codenames) return;

      state.codenames.players[clientId] = {
        id: clientId,
        team: null,
        role: "spectator",
      };
    });

    // Send the current game state to the new client
    const state = context.getState() as { codenames?: CodenamesPluginState };
    if (!state.codenames) return;

    context.sendTo(clientId, {
      type: CODENAMES_PLUGIN_ID,
      data: {
        gameState: state.codenames,
      },
    });
  },

  onClientDisconnect(clientId, context) {
    // Remove the client from the players list
    context.setState((state) => {
      if (!state.codenames) return;

      delete state.codenames.players[clientId];
    });
  },

  onMessage(clientId, message, context) {
    if (message.type !== CODENAMES_PLUGIN_ID) return;

    const data = message.data as CodenamesClientMessageData;
    const state = context.getState() as { codenames?: CodenamesPluginState };

    if (!state.codenames) return;

    switch (data.action) {
      case "start":
        this.startGame(context);
        break;

      case "stop":
        this.stopGame(context);
        break;

      case "join":
        if (state.codenames.gameActive) return; // Can't join during active game

        context.setState((state) => {
          if (!state.codenames) return;

          state.codenames.players[clientId] = {
            id: clientId,
            team: data.team as TeamColor | null,
            role: data.role || "operative",
          };
        });
        break;

      case "reveal":
        if (!state.codenames.gameActive || !data.cardId) return;

        const player = state.codenames.players[clientId];
        if (
          !player || player.role !== "operative" ||
          player.team !== state.codenames.currentTurn
        ) {
          return; // Only operatives on the current team can reveal cards
        }

        this.revealCard(data.cardId, context);
        break;

      case "endTurn":
        if (!state.codenames.gameActive) return;

        const currentPlayer = state.codenames.players[clientId];
        if (
          !currentPlayer || currentPlayer.role !== "operative" ||
          currentPlayer.team !== state.codenames.currentTurn
        ) {
          return; // Only operatives on the current team can end the turn
        }

        context.setState((state) => {
          if (!state.codenames || state.codenames.winner) return;

          // Switch turns
          state.codenames.currentTurn = state.codenames.currentTurn === "red"
            ? "blue"
            : "red";
        });
        break;
    }

    // Broadcast the updated game state to all clients
    this.broadcastGameState(context);
  },

  startGame(context) {
    context.setState((state) => {
      if (!state.codenames) return;

      // Reset game state
      state.codenames.gameActive = true;
      state.codenames.currentTurn = Math.random() < 0.5 ? "red" : "blue";
      state.codenames.redScore = 0;
      state.codenames.blueScore = 0;
      state.codenames.winner = null;

      // Create the card grid
      state.codenames.cards = this.generateCards();
    });
  },

  stopGame(context) {
    context.setState((state) => {
      if (!state.codenames) return;

      state.codenames.gameActive = false;
      state.codenames.cards = [];
    });
  },

  revealCard(cardId: number, context) {
    context.setState((state) => {
      if (
        !state.codenames || !state.codenames.gameActive ||
        state.codenames.winner
      ) return;

      const card = state.codenames.cards.find((c) => c.id === cardId);
      if (!card || card.revealed) return;

      // Reveal the card
      card.revealed = true;

      // Handle the consequences of revealing this card
      if (card.team === "assassin") {
        // Game over - current team loses
        state.codenames.winner = state.codenames.currentTurn === "red"
          ? "blue"
          : "red";
      } else if (card.team === "red") {
        state.codenames.redScore++;

        // Check if red team has won
        const redCardsRemaining = state.codenames.cards.filter(
          (c) => c.team === "red" && !c.revealed,
        ).length;

        if (redCardsRemaining === 0) {
          state.codenames.winner = "red";
        }

        // End turn if the card wasn't for the current team
        if (state.codenames.currentTurn !== "red") {
          state.codenames.currentTurn = "red";
        }
      } else if (card.team === "blue") {
        state.codenames.blueScore++;

        // Check if blue team has won
        const blueCardsRemaining = state.codenames.cards.filter(
          (c) => c.team === "blue" && !c.revealed,
        ).length;

        if (blueCardsRemaining === 0) {
          state.codenames.winner = "blue";
        }

        // End turn if the card wasn't for the current team
        if (state.codenames.currentTurn !== "blue") {
          state.codenames.currentTurn = "blue";
        }
      } else {
        // Neutral card - end the current team's turn
        state.codenames.currentTurn = state.codenames.currentTurn === "red"
          ? "blue"
          : "red";
      }
    });
  },

  generateCards(): CodenamesCard[] {
    // Shuffle the word list and take 25 words
    const shuffledWords = [...CODENAMES_WORDS].sort(() => Math.random() - 0.5)
      .slice(0, 25);

    // Determine which team goes first (they get 9 cards, the other team gets 8)
    const firstTeam: TeamColor = Math.random() < 0.5 ? "red" : "blue";
    const secondTeam: TeamColor = firstTeam === "red" ? "blue" : "red";

    // Create team assignments
    const teamAssignments: TeamColor[] = [
      ...Array(9).fill(firstTeam),
      ...Array(8).fill(secondTeam),
      ...Array(7).fill("neutral"),
      "assassin",
    ];

    // Shuffle team assignments
    const shuffledTeams = [...teamAssignments].sort(() => Math.random() - 0.5);

    // Create the grid of cards (5x5)
    const cards: CodenamesCard[] = [];
    const cardWidth = 140;
    const cardHeight = 90;
    const cardSpacing = 10;

    for (let i = 0; i < 25; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;

      cards.push({
        id: i,
        word: shuffledWords[i],
        revealed: false,
        team: shuffledTeams[i],
        x: 100 + col * (cardWidth + cardSpacing),
        y: 100 + row * (cardHeight + cardSpacing),
      });
    }

    return cards;
  },

  broadcastGameState(context) {
    const state = context.getState() as { codenames?: CodenamesPluginState };
    if (!state.codenames) return;

    context.broadcast({
      type: CODENAMES_PLUGIN_ID,
      data: {
        gameState: state.codenames,
      },
    });
  },
};
