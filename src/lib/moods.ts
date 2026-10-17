import type { MoodDefinition, MoodId } from "./types";

/**
 * Los "moods" sustituyen a los géneros: cada uno es una consulta TMDB real
 * (géneros + keywords + orden + umbral de votos) y una identidad cromática.
 * Las keywords se combinan con OR dentro de `with_keywords`.
 */
export const MOODS: MoodDefinition[] = [
  {
    id: "neon-melancolia",
    label: "Melancolía neón",
    essence: "Soledad urbana bajo luz sintética",
    description:
      "Ciudades lluviosas, rótulos de neón y personajes que hablan con máquinas o con su propio reflejo. La tristeza se vuelve luminosa.",
    accent: "#ff77a8",
    colorFamily: "magenta",
    genreIds: [878, 80, 53, 18],
    keywordIds: [10084, 9715, 3834, 236836, 18035],
    sortBy: "popularity.desc",
    minVoteCount: 400,
  },
  {
    id: "vertigo-cosmico",
    label: "Vértigo cósmico",
    essence: "La escala del universo contra la escala del cuerpo",
    description:
      "Viajes interestelares, vacíos silenciosos y revelaciones que empequeñecen. Sublime tecnológico con fotografía de gran formato.",
    accent: "#7fdcff",
    colorFamily: "cian",
    genreIds: [878, 12, 9648],
    keywordIds: [3801, 4565, 159044, 33564],
    sortBy: "vote_average.desc",
    minVoteCount: 900,
  },
  {
    id: "dilema-moral",
    label: "Dilema moral",
    essence: "Ninguna opción deja las manos limpias",
    description:
      "Tribunales, chantajes, delaciones y pactos. El conflicto no está fuera: está en la decisión que nadie quiere tomar.",
    accent: "#e9c673",
    colorFamily: "oro",
    genreIds: [18, 80, 53, 36],
    keywordIds: [9713, 10183, 242, 699, 10726],
    sortBy: "vote_average.desc",
    minVoteCount: 700,
  },
  {
    id: "onirico",
    label: "Deriva onírica",
    essence: "La lógica del sueño sustituye a la del guion",
    description:
      "Narrativas que se pliegan, identidades que se derriten y una cámara que flota. Verlas es recordar algo que no viviste.",
    accent: "#cd87ef",
    colorFamily: "purpura",
    genreIds: [18, 9648, 14, 878],
    keywordIds: [4379, 10183, 699, 9715],
    sortBy: "popularity.desc",
    minVoteCount: 300,
  },
  {
    id: "austero",
    label: "Silencio austero",
    essence: "Plano fijo, luz natural, tiempo real",
    description:
      "Contemplación radical: pocas palabras, muchas miradas. Un cine que exige paciencia y devuelve una calma casi física.",
    accent: "#aca79a",
    colorFamily: "neutro",
    genreIds: [18, 36, 99],
    keywordIds: [9713, 2041, 6152],
    sortBy: "vote_average.desc",
    minVoteCount: 150,
  },
  {
    id: "fiebre",
    label: "Fiebre obsesiva",
    essence: "Un deseo que consume a quien lo siente",
    description:
      "Perfeccionismo, venganza, adicción o amor llevado al límite. El pulso de la película se acelera hasta romperse.",
    accent: "#f08276",
    colorFamily: "carmesi",
    genreIds: [53, 18, 80, 27],
    keywordIds: [9715, 1732, 699, 10726],
    sortBy: "popularity.desc",
    minVoteCount: 500,
  },
  {
    id: "ritual-sangre",
    label: "Ritual y sangre",
    essence: "El horror como ceremonia",
    description:
      "Folclore, sectas, cuerpos que se transforman. La violencia tiene liturgia, vestuario y una estética cuidada al milímetro.",
    accent: "#f0716a",
    colorFamily: "carmesi",
    genreIds: [27, 53, 9648],
    keywordIds: [1732, 10788, 34257, 6152],
    sortBy: "popularity.desc",
    minVoteCount: 350,
  },
  {
    id: "memoria-tiempo",
    label: "Memoria y tiempo",
    essence: "El recuerdo como materia narrativa",
    description:
      "Bucles, elipsis, archivos familiares y futuros que ya ocurrieron. El montaje es el verdadero protagonista.",
    accent: "#f6a765",
    colorFamily: "ambar",
    genreIds: [878, 18, 9648, 10749],
    keywordIds: [4379, 9713, 18035, 2041],
    sortBy: "vote_average.desc",
    minVoteCount: 400,
  },
  {
    id: "vinculo",
    label: "Vínculo imposible",
    essence: "Dos personas que no pueden estar y no pueden no estar",
    description:
      "Amores fuera de tiempo, amistades que salvan y despedidas largas. La cámara se acerca hasta que incomoda.",
    accent: "#f48cc2",
    colorFamily: "rosa",
    genreIds: [10749, 18, 35],
    keywordIds: [699, 242, 9713, 10726],
    sortBy: "vote_average.desc",
    minVoteCount: 400,
  },
  {
    id: "absurdo",
    label: "Absurdo luminoso",
    essence: "Reírse del desastre con composición perfecta",
    description:
      "Sátira, esperpento y humor negro con un control formal absoluto. Todo es ridículo y nada es inocente.",
    accent: "#c9dc7d",
    colorFamily: "acido",
    genreIds: [35, 18, 80],
    keywordIds: [9715, 699, 33564],
    sortBy: "popularity.desc",
    minVoteCount: 500,
  },
];

export const MOOD_MAP: Record<MoodId, MoodDefinition> = MOODS.reduce(
  (acc, mood) => {
    acc[mood.id] = mood;
    return acc;
  },
  {} as Record<MoodId, MoodDefinition>,
);

export const DEFAULT_MOOD_ID: MoodId = "neon-melancolia";

/**
 * Puntúa la afinidad de una película con un mood usando sus géneros.
 * Se usa para ordenar/mezclar resultados cuando la API no devuelve keywords.
 */
export function moodAffinityScore(genreIds: number[] | undefined, mood: MoodDefinition): number {
  if (!genreIds || genreIds.length === 0) return 0.18;
  const matches = genreIds.filter((id) => mood.genreIds.includes(id)).length;
  const base = matches / Math.max(1, mood.genreIds.length);
  return Math.min(1, 0.2 + base * 1.6);
}
