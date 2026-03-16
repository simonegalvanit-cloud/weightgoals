export const THEMES: Record<string, {
  bg: string; card: string; accent: string; accentL: string; accentXL: string;
  grn: string; grnBg: string; lav: string;
  txt: string; txt2: string; txt3: string; brd: string; name: string;
}> = {
  pink: { bg:"#fdf6f9", card:"#fff", accent:"#d4829e", accentL:"#f0c8d8", accentXL:"#f8e4ee", grn:"#6aaa88", grnBg:"#e8f5ee", lav:"#d0a8e0", txt:"#4a3848", txt2:"#9a8898", txt3:"#c8b8c4", brd:"rgba(180,140,168,0.12)", name:"Rose" },
  lavender: { bg:"#f6f4fd", card:"#fff", accent:"#9a7bc5", accentL:"#d4c4f0", accentXL:"#ede4fa", grn:"#6aaa88", grnBg:"#e8f5ee", lav:"#b890e0", txt:"#3a3050", txt2:"#8a7a9a", txt3:"#b8a8d0", brd:"rgba(140,120,180,0.12)", name:"Lavender" },
  mint: { bg:"#f4faf7", card:"#fff", accent:"#5aaa8a", accentL:"#b8e0d0", accentXL:"#daf0e8", grn:"#5aaa8a", grnBg:"#e0f5ed", lav:"#80c8a8", txt:"#2a4038", txt2:"#7a9a8a", txt3:"#a8c8b8", brd:"rgba(100,160,140,0.12)", name:"Mint" },
  sunset: { bg:"#fdf6f2", card:"#fff", accent:"#d08050", accentL:"#f0c8a0", accentXL:"#f8e4d0", grn:"#6aaa88", grnBg:"#e8f5ee", lav:"#e0a870", txt:"#4a3020", txt2:"#9a7860", txt3:"#c8a888", brd:"rgba(180,140,100,0.12)", name:"Sunset" },
};

export const MOOD_OPTIONS = ["😊","💪","😴","😤","🥰","🔥","😢","🎉"];

export const FONTS = {
  serif: "'Cormorant Garamond',Georgia,serif",
  sans: "'Nunito Sans',-apple-system,sans-serif",
};
