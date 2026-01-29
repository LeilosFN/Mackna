const folderPathEl = document.getElementById("folderPath");
let fortnitePath = "";

document.getElementById("selectFolder").addEventListener("click", async () => {
  const path = await window.api.selectFolder();
  if (path) {
    fortnitePath = path;
    folderPathEl.textContent = path;
  }
});

document.getElementById("launchGame").addEventListener("click", async () => {
  if (!fortnitePath) return alert("Selecciona primero la carpeta de Fortnite.");
  await window.api.launch(fortnitePath);
  alert("Fortnite lanzado con Leilos backend!");
});
