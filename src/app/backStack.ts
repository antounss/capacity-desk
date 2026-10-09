// The Android back button. Open sheets register a "close me" handler here; pressing
// back closes the top one. With nothing open, the App component decides what back does.

type Handler = () => void;
const stack: Handler[] = [];

export function pushBack(handler: Handler): () => void {
  stack.push(handler);
  return () => {
    const index = stack.lastIndexOf(handler);
    if (index >= 0) stack.splice(index, 1);
  };
}

/** Runs the top handler. Returns false when there was nothing to close. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}
