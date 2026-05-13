async function fetchJson() {
  const res = await fetch("https://sports.vodep39240327.workers.dev/sports111.json");
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
fetchJson();
