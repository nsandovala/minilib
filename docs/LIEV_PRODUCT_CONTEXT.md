# Liev Product Context

Documento de referencia para agentes y colaboradores que trabajen en MiniLib / Liev.

## Qué es Liev

Liev es el primer producto comercial simple del ecosistema AMON.

No debe presentarse como:
- otra app de IA
- un clon de Memorae
- una puerta visible al ecosistema completo de AMON

Liev debe sentirse como una libreta cotidiana, calmada, minimalista y clara.

## Arquitectura de marca

- `AMON` = marca madre e infraestructura digital orientada al bienestar humano
- `Liev` = producto de entrada; libreta tranquila para lo cotidiano
- `HEO` = futura capa de inteligencia / motor asistente; no es el protagonista inicial de marketing

## Posicionamiento central

Tagline principal:

> Liev — una libreta tranquila para lo cotidiano.

Promesa de producto:

> Anota pagos, compras, salud, casa, mascotas y pendientes diarios. Liev los ordena automáticamente para que no tengas que cargar todo en la cabeza.

## Diferenciación estratégica

- `Memorae` = memoria personal expandida
- `Liev` = calma cotidiana y orden práctico

Liev no compite por “más inteligencia visible”, sino por alivio mental real en tareas diarias.

## Categorías iniciales

- Compra
- Pago
- Salud
- Mascota
- Casa
- Calendario

## Experiencia principal

Flujo esperado:

1. El usuario escribe de forma natural.
2. Liev entiende y clasifica.
3. Liev crea una card útil y clara.
4. El usuario siente alivio mental.

Fórmula de producto:

> Anoto desordenado → Liev entiende → crea una card útil → descanso mental.

## Reglas de producto

- No agregar complejidad visible.
- No sobreexplicar IA.
- No exponer módulos de AMON en el MVP.
- No vender salud, SOS, POS, Delivery o Radar en el lanzamiento.
- No agregar UX centrada en chatbot.
- Menos features visibles, más alivio real.
- Mantener una sensación tipo Apple: mínima, premium, clara y humana.
- La inteligencia debe sentirse invisible y útil.

## Implicación de ingeniería

Toda feature, ajuste visual o decisión técnica debe reforzar la promesa central de alivio cognitivo.

Pregunta obligatoria antes de implementar:

> ¿Esto reduce carga mental al usuario?

Si la respuesta es no, no debe implementarse.

## Criterios concretos para UI

- Priorizar claridad sobre cantidad de elementos.
- Preferir cards compactas pero útiles.
- Mostrar contexto sólo cuando ayude a decidir o recordar algo.
- Evitar jerarquías visuales ruidosas.
- Evitar lenguaje técnico sobre automatización o IA en la experiencia principal.
- La clasificación debe percibirse como natural, no como una feature compleja.

## Criterios concretos para nuevos cambios

- Si una mejora no reduce fricción, se descarta.
- Si una pantalla exige explicación extra, probablemente está demasiado compleja.
- Si una interacción compite con la captura rápida de texto, está mal priorizada.
- Si una función se siente “demo de IA” en vez de “herramienta tranquila”, no encaja con Liev.

## Nota para agentes

Cuando haya dudas entre varias opciones de implementación, elegir la que:

- reduzca más carga cognitiva
- exponga menos complejidad
- mantenga a Liev como producto principal, no a AMON ni a HEO
- mejore la utilidad inmediata de la card final
