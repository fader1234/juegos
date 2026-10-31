# 🎮 Portal de Juegos

Juegos para jugar en el navegador, sin instalar nada.
Disponible en 🇪🇸 español, 🇬🇧 inglés, 🇮🇹 italiano y 🇷🇺 ruso.

## Juegos

| Juego | Categoría | Contra la computadora |
|-------|-----------|:---:|
| Escoba de 15 (baraja napolitana) | Cartas | ✅ 3 niveles |
| Tatetí | Estrategia | ✅ |

## Estructura

```
index.html            Portada del portal
css/portal.css        Estilos comunes
js/i18n.js            Sistema de idiomas (compartido)
js/games.js           Lista de juegos  ← aquí se registran
js/portal.js          Lógica de la portada
games/<id>/           Cada juego en su carpeta
```

## Cómo añadir un juego

1. Crea `games/<id-del-juego>/index.html`.
2. Carga `../../js/i18n.js` y añade los textos con `I18N.add({ es, en, it, ru })`.
3. Usa la barra `game-bar` con `I18N.mount(...)` para el enlace al portal y el selector de idioma.
4. Registra el juego en `js/games.js` (título y descripción en los 4 idiomas).

## Publicarlo

En GitHub: **Settings → Pages → Branch: `main` / `(root)` → Save**.
El portal quedará en `https://fader1234.github.io/juegos/`.
