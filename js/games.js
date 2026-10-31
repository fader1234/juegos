/*
 * Lista de juegos del portal.
 * Para añadir un juego nuevo:
 *   1. Crea la carpeta games/<id>/ con su index.html
 *   2. Añade aquí un objeto con sus datos (textos en es, en, it, ru)
 *   3. "categoria" debe ser una clave de CATEGORIAS (abajo)
 */
const CATEGORIAS = {
  cartas: { es: "Cartas", en: "Cards", it: "Carte", ru: "Карты" },
  estrategia: { es: "Estrategia", en: "Strategy", it: "Strategia", ru: "Стратегия" },
};

const GAMES = [
  {
    id: "ajedrez",
    imagen: "games/ajedrez/thumb.png",
    emoji: "♞",
    categoria: "estrategia",
    color: "#a8323f",
    titulo: {
      es: "Ajedrez de las novelas",
      en: "Novel Chess",
      it: "Scacchi dei romanzi",
      ru: "Шахматы с героями романов",
    },
    descripcion: {
      es: "Desafía a los personajes de Litmir: Natalia, Roberto, Natasha y Luis, cada uno más fuerte que el anterior.",
      en: "Challenge the Litmir characters: Natalia, Roberto, Natasha and Luis, each stronger than the last.",
      it: "Sfida i personaggi di Litmir: Natalia, Roberto, Nataša e Luis, ognuno più forte del precedente.",
      ru: "Сразитесь с героями Litmir: Натальей, Роберто, Наташей и Луисом — каждый сильнее предыдущего.",
    },
  },
  {
    id: "escoba",
    imagen: "games/escoba/thumb.svg",
    emoji: "🃏",
    categoria: "cartas",
    color: "#d4a017",
    titulo: {
      es: "Escoba de 15",
      en: "Escoba (15)",
      it: "Scopa a 15",
      ru: "Эскоба на 15",
    },
    descripcion: {
      es: "El clásico juego de cartas con baraja napolitana. Suma 15 y barre la mesa contra la computadora.",
      en: "The classic card game with a Neapolitan deck. Make 15 and sweep the table against the computer.",
      it: "Il classico gioco di carte con le carte napoletane. Fai 15 e spazza il tavolo contro il computer.",
      ru: "Классическая карточная игра с неаполитанской колодой. Набирайте 15 и сметайте стол в игре против компьютера.",
    },
  },
  {
    id: "tres-en-raya",
    emoji: "❌⭕",
    categoria: "estrategia",
    color: "#7c5cff",
    titulo: {
      es: "Tatetí",
      en: "Tic-tac-toe",
      it: "Tris",
      ru: "Крестики-нолики",
    },
    descripcion: {
      es: "El clásico de siempre. Juega contra un amigo o contra la máquina.",
      en: "The timeless classic. Play against a friend or the computer.",
      it: "Il classico di sempre. Gioca contro un amico o contro il computer.",
      ru: "Вечная классика. Играйте с другом или против компьютера.",
    },
  },
];
