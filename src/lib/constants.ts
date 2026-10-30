export const CATEGORIES = ['scarf', 'hat', 'bag', 'earrings', 'necklace', 'top', 'ring', 'watch', 'look'] as const;
export const NEEDS_HAND = ['ring', 'watch'] as const;
export const COLORS = ['black', 'white', 'beige', 'brown', 'green', 'orange', 'pink', 'gold', 'silver'] as const;
export const DELETE_AFTER_DAYS = [1, 7, 30] as const;
export type Category = (typeof CATEGORIES)[number];
