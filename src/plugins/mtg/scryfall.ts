interface ScryfallCard {
  name: string;
  mana_cost?: string;
  type_line?: string;
  power?: string;
  toughness?: string;
  oracle_text?: string;
  image_uris?: {
    normal?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

class Scryfall {
  private static baseUrl: string = "https://api.scryfall.com";

  /**
   * Fetches a random creature card with specified converted mana cost
   * @param cmc - Converted mana cost
   * @returns Card data
   */
  public static async momir(cmc: number): Promise<ScryfallCard> {
    try {
      const url = `${this.baseUrl}/cards/random?q=type:creature cmc=${cmc}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.status}`);
      }

      const card = await response.json() as ScryfallCard;
      this.prettyPrint(card);
      return card;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error fetching random card: ${error.message}`);
      } else {
        console.error("Unknown error fetching random card", error);
      }
      throw error;
    }
  }

  /**
   * Pretty prints card information to console
   * @param card - Card data from Scryfall
   */
  private static prettyPrint(card: ScryfallCard): void {
    console.log("\n=== RANDOM CREATURE CARD ===");
    console.log(`Name: ${card.name}`);
    console.log(`Mana Cost: ${card.mana_cost || "N/A"}`);
    console.log(`Type: ${card.type_line || "N/A"}`);

    if (card.power && card.toughness) {
      console.log(`P/T: ${card.power}/${card.toughness}`);
    }

    console.log(`Text: ${card.oracle_text || "N/A"}`);

    if (card.image_uris && typeof card.image_uris.normal === "string") {
      console.log(`Image: ${card.image_uris.normal}`);
    }

    console.log("============================\n");
  }
}

export default Scryfall;
