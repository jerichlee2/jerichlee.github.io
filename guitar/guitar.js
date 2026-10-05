// Keep the list compact and preserve each recording's seeking position.
const recordings = Array.from(document.querySelectorAll('.guitar-recording details'));
for (const details of recordings) {
  const audio = details.querySelector('audio');

  details.addEventListener('toggle', () => {
    if (!details.open) {
      audio.pause();
      return;
    }

    // Only fetch metadata once the listener chooses this song. Opening does not play it.
    audio.preload = 'metadata';
    for (const other of recordings) {
      if (other !== details) {
        other.querySelector('audio').pause();
        other.open = false;
      }
    }
  });

  audio.addEventListener('play', () => {
    details.open = true;
    for (const other of recordings) {
      if (other !== details) other.querySelector('audio').pause();
    }
  });
}

// Existing links to individual recordings still reveal the relevant player.
function revealLinkedRecording() {
  let id;
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  const row = document.getElementById(id)?.closest('.guitar-recording');
  if (row) row.querySelector('details').open = true;
}

window.addEventListener('hashchange', revealLinkedRecording);
revealLinkedRecording();
