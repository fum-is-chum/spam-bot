export const shuffle = (array: string[]) => {
  const tmp = array[0];
  const len = array.length;
  for (let i = 1; i < len; i++) {
    array[i - 1] = array[i];
  }

  array[len - 1] = tmp;
}