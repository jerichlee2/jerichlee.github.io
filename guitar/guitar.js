// Keep recordings from playing over one another; seeking positions are retained.
const recordings = Array.from(document.querySelectorAll('.guitar-recording audio'));
for (const recording of recordings) {
  recording.addEventListener('play', () => {
    for (const other of recordings) {
      if (other !== recording) other.pause();
    }
  });
}
