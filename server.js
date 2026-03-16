import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Équivalent de __dirname en mode ES modules.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier généré par `vite build`.
const distPath = path.join(__dirname, 'dist');

// Port Infomaniak (ou 3000 en local).
const PORT = process.env.PORT || 3000;

// Sert les fichiers statiques (JS, CSS, images...).
app.use(express.static(distPath));

// Fallback SPA: renvoie index.html pour les routes React.
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
