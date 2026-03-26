// Polyfill for Promise.try (Stage 4 proposal) to fix "Promise.try is not a function" error
if (typeof Promise.try !== 'function') {
  // @ts-ignore
  Promise.try = function(callback: () => any) {
    return new Promise((resolve, reject) => {
      try {
        resolve(callback());
      } catch (error) {
        reject(error);
      }
    });
  };
}

declare global {
  interface PromiseConstructor {
    try<T>(callback: () => T | PromiseLike<T>): Promise<T>;
  }
}

export {};
