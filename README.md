# Private chatbot: Self-hosted E2E Encryption Custom App demo and repo

The Flask server does decrypt temporarily but has zero-access to storage. The Vue frontend uses Web Crypto API. Ollama + Gemma 3 4b. Experimental prototype.

Inspired by the privacy-first Proton Lumo of Switzerland. This is hosted in London powered by renewables with Katapult. Nvidia T4 16GB, 6GB RAM CPU VPS with 50GB storage. I couldn't comfortably run the faster inference model vllm with unquantized models on this graphics card.
