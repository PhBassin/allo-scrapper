const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const ALL = UPPERCASE + LOWERCASE + DIGITS + SPECIAL;
const LENGTH = 16;

function getRandomChar(chars: string, randomArray: Uint8Array, offset: number): string {
  return chars[randomArray[offset] % chars.length];
}

function fisherYatesShuffle(chars: string[], randomArray: Uint8Array): void {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomArray[i] % (chars.length);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
}

export function generateRandomPassword(): string {
  const randomArray = new Uint8Array(LENGTH * 2);
  crypto.getRandomValues(randomArray);

  let password = '';
  password += getRandomChar(UPPERCASE, randomArray, 0);
  password += getRandomChar(LOWERCASE, randomArray, 1);
  password += getRandomChar(DIGITS, randomArray, 2);
  password += getRandomChar(SPECIAL, randomArray, 3);

  for (let i = 4; i < LENGTH; i++) {
    password += getRandomChar(ALL, randomArray, i);
  }

  const chars = password.split('');
  const shuffleRandom = randomArray.slice(LENGTH);
  fisherYatesShuffle(chars, shuffleRandom);
  return chars.join('');
}
