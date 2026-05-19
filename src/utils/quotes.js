export const getDailyQuote = () => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = new Date().getDay();
  
  const quotes = {
    Monday: { theme: "Finansial", text: "Disiplin hari ini adalah pondasi kebebasan finansial Anda di masa depan." },
    Tuesday: { theme: "Kesehatan", text: "Trading yang hebat dimulai dengan tubuh yang bugar. Jangan lupa bergerak hari ini." },
    Wednesday: { theme: "Rohani", text: "Harta hanyalah titipan. Gunakan ia untuk kebermanfaatan dan tetaplah rendah hati." },
    Thursday: { theme: "Sosial", text: "Kesuksesan sejati diukur dari seberapa banyak orang yang terbantu oleh kesuksesan kita." },
    Friday: { theme: "Refleksi", text: "Jeda sejenak untuk bersyukur adalah investasi mental terbaik bagi seorang trader." },
    Saturday: { theme: "Keluarga", text: "Investasi terbaik adalah waktu yang dihabiskan bersama orang tercinta." },
    Sunday: { theme: "Persiapan", text: "Minggu adalah waktu untuk menata ulang strategi, bukan hanya untuk beristirahat." }
  };
  
  return quotes[days[today]];
};