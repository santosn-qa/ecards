import type { Occasion } from './templates'

export type SampleMessage = {
  tone: string
  text: string
}

export const sampleMessagesByOccasion: Record<Occasion, SampleMessage[]> = {
  Birthday: [
    { tone: 'Heartfelt', text: "Wishing you a birthday as wonderful as you are. Here's to another year of chasing joy and making memories. Happy birthday!" },
    { tone: 'Playful', text: "Another year older, another year of being awesome. Go eat some cake, you've earned it. Happy birthday!" },
    { tone: 'Short & sweet', text: 'Happy birthday! Hope your day is full of cake, laughter, and everything you love.' },
  ],
  'Thank you': [
    { tone: 'Heartfelt', text: "I don't say it enough, but I'm so grateful for you. Thank you for everything you do — it means more than words can say." },
    { tone: 'Playful', text: 'You plus kindness equals the best combo ever. Thanks a million for being amazing!' },
    { tone: 'Short & sweet', text: 'Just a little note to say... thank you. Truly.' },
    { tone: 'Formal', text: 'Please accept my sincere thanks for your generosity and thoughtfulness. It is deeply appreciated.' },
  ],
  Congratulations: [
    { tone: 'Heartfelt', text: "You worked so hard for this, and it shows. I'm so proud of you and everything you've achieved. Congratulations!" },
    { tone: 'Playful', text: 'Look at you, being all successful and stuff. Congrats, you rockstar!' },
    { tone: 'Short & sweet', text: 'Congratulations! You did it, and you deserve every bit of this moment.' },
    { tone: 'Formal', text: 'Congratulations on this well-earned achievement. Wishing you continued success ahead.' },
  ],
  Love: [
    { tone: 'Heartfelt', text: 'Every day with you feels like a gift. Thank you for loving me the way you do. I love you more than words can hold.' },
    { tone: 'Playful', text: "You're stuck with me forever now, sorry not sorry. Love you to the moon and back!" },
    { tone: 'Short & sweet', text: 'Just wanted to remind you: I love you. Always have, always will.' },
  ],
  'Just because': [
    { tone: 'Heartfelt', text: "No reason needed — just wanted you to know you're thought of today, and that you matter more than you know." },
    { tone: 'Playful', text: 'Sending you a random burst of good vibes because why not? Hope this made you smile.' },
    { tone: 'Short & sweet', text: 'Just because. Thinking of you today.' },
  ],
}

export function getSampleMessages(occasion: Occasion): SampleMessage[] {
  return sampleMessagesByOccasion[occasion]
}
