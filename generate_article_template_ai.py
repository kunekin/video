#!/usr/bin/env python3
"""
Generate Article Template dengan Content AI
- Input: keyword
- Generate content dengan AI (OpenAI atau Ollama)
- Fill article-template.html dengan data
- Output: HTML file dengan content AI
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

# OpenAI
try:
    import openai
    OPENAI_AVAILABLE = True
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
    openai.api_key = os.getenv('OPENAI_API_KEY')
    if not openai.api_key:
        OPENAI_AVAILABLE = False
except ImportError:
    OPENAI_AVAILABLE = False

# Ollama (Local AI)
try:
    import requests
    OLLAMA_AVAILABLE = True
    OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
    OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.1:8b')
except ImportError:
    OLLAMA_AVAILABLE = False

# AI Service selection
AI_SERVICE = os.getenv('AI_SERVICE', 'ollama' if OLLAMA_AVAILABLE else 'openai' if OPENAI_AVAILABLE else None)

def detect_language(keyword):
    """
    Detect language dari keyword menggunakan fastText (lebih akurat untuk keyword pendek)
    Fallback ke langdetect jika fastText tidak tersedia
    
    NOTE: fastText lebih akurat untuk keyword pendek karena:
    - Menggunakan word embeddings dan neural networks
    - Pre-trained dengan dataset besar (176 languages)
    - Accuracy ~90% untuk keyword pendek (vs ~70% untuk langdetect)
    
    fastText adalah GRATIS (open source dari Facebook)
    """
    keyword_lower = keyword.lower()
    
    # PRIMARY: Use fastText (lebih akurat untuk keyword pendek)
    try:
        import fasttext
        import os
        import urllib.request
        
        model_path = 'lid.176.bin'
        
        # Download model jika belum ada
        if not os.path.exists(model_path):
            try:
                print("📥 Downloading fastText language detection model (first time only, ~130MB)...")
                urllib.request.urlretrieve(
                    'https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin',
                    model_path
                )
                print("✅ Model downloaded successfully")
            except Exception as e:
                print(f"⚠️  Failed to download fastText model: {e}")
                print("   Falling back to langdetect...")
                raise ImportError("fastText model not available")
        
        # Load model (cached after first load)
        if not hasattr(detect_language, '_fasttext_model'):
            detect_language._fasttext_model = fasttext.load_model(model_path)
        
        model = detect_language._fasttext_model
        
        # Predict language (with numpy compatibility fix)
        try:
            predictions = model.predict(keyword, k=1)
            lang_code = predictions[0][0].replace('__label__', '')
            # Handle numpy array compatibility
            confidence = float(predictions[1][0]) if hasattr(predictions[1][0], '__float__') else predictions[1][0]
        except (ValueError, TypeError) as e:
            # NumPy compatibility issue - try alternative method
            try:
                import numpy as np
                predictions = model.predict(keyword, k=1)
                lang_code = predictions[0][0].replace('__label__', '')
                confidence = np.asarray(predictions[1])[0] if isinstance(predictions[1], (list, tuple)) else float(predictions[1][0])
            except:
                # If still fails, use langdetect fallback
                raise ImportError("fastText prediction failed")
        
        # Map fastText language codes to our language codes
        lang_map = {
            'id': 'id', 'en': 'en', 'es': 'es', 'fr': 'fr', 'de': 'de',
            'pt': 'pt', 'it': 'it', 'ja': 'ja', 'zh': 'zh', 'zh-cn': 'zh',
            'zh-tw': 'zh-tw', 'ar': 'ar', 'ru': 'ru', 'nl': 'nl', 'pl': 'pl',
            'tr': 'tr', 'ko': 'ko', 'vi': 'vi', 'th': 'th', 'hi': 'hi', 'tl': 'tl'
        }
        
        # If confidence is reasonable (>50%), use fastText result
        if confidence > 0.50:
            if lang_code in lang_map:
                return lang_map[lang_code]
            # If language not in map, return as-is (fastText supports 176 languages)
            return lang_code
        
        # Low confidence - fallback to langdetect
        
    except ImportError:
        # fastText not installed - fallback to langdetect
        pass
    except Exception as e:
        # fastText error - fallback to langdetect
        pass
    
    # FALLBACK: Use langdetect jika fastText tidak tersedia
    try:
        from langdetect import detect_langs, LangDetectException
        try:
            langs = detect_langs(keyword)
            
            if not langs:
                raise LangDetectException("No languages detected")
            
            top_lang = langs[0]
            top_confidence = top_lang.prob
            detected_lang = top_lang.lang
            
            # If confidence is high (>80%), trust langdetect
            if top_confidence > 0.80:
                lang_map = {
                    'id': 'id', 'en': 'en', 'es': 'es', 'fr': 'fr', 'de': 'de',
                    'pt': 'pt', 'it': 'it', 'ja': 'ja', 'zh': 'zh', 'zh-cn': 'zh-cn',
                    'zh-tw': 'zh-tw', 'ar': 'ar', 'ru': 'ru', 'nl': 'nl', 'pl': 'pl',
                    'tr': 'tr', 'ko': 'ko', 'vi': 'vi', 'th': 'th', 'hi': 'hi', 'tl': 'tl'
                }
                if detected_lang in lang_map:
                    return lang_map[detected_lang]
            
        except LangDetectException:
            pass
    except ImportError:
        pass
    except Exception:
        pass
    
    # FINAL FALLBACK: Use manual patterns jika semua detection gagal
    indonesian_keywords = [
        'gacor', 'hari', 'ini', 'cara', 'tips', 'panduan', 'dengan', 'untuk',
        'adalah', 'yang', 'dari', 'pada', 'atau', 'juga', 'akan', 'sudah', 'belum',
        'menang', 'bermain', 'terbaik', 'paling', 'banyak', 'semua', 'bisa',
        'judi', 'togel', 'situs', 'agen', 'bonus', 'promo', 'deposit',
        'withdraw', 'daftar', 'login', 'main', 'permainan', 'uang', 'rupiah',
        'investasi', 'saham', 'belajar', 'bahasa', 'hidup', 'sehat', 'pola', 'ampuh',
        'makan', 'minum', 'olahraga', 'kesehatan', 'tubuh', 'jiwa', 'mental'
    ]
    
    english_patterns = ['for', 'the', 'and', 'with', 'dating', 'single', 'man', 'best', 'top',
                       'navigating', 'conflicts', 'relationships', 'in', 'of', 'to', 'on', 'at',
                       'how', 'what', 'when', 'where', 'why', 'who', 'which', 'online', 'sites',
                       'investment', 'strategies', 'guide', 'complete', 'ways']
    
    has_indonesian = any(kw in keyword_lower for kw in indonesian_keywords)
    has_english = any(pattern in keyword_lower for pattern in english_patterns)
    
    if has_indonesian:
        return 'id'
    elif has_english:
        return 'en'
    else:
        # Default to English if unclear (most common language for SEO content)
        return 'en'

# Language instruction mapping
lang_instruction_map = {
    'id': 'Write in Indonesian (Bahasa Indonesia)',
    'en': 'Write in English',
    'es': 'Write in Spanish (Español)',
    'fr': 'Write in French (Français)',
    'de': 'Write in German (Deutsch)',
    'pt': 'Write in Portuguese (Português)',
    'it': 'Write in Italian (Italiano)',
    'ja': 'Write in Japanese (日本語)',
    'zh': 'Write in Chinese (中文)',
    'zh-cn': 'Write in Simplified Chinese (简体中文)',
    'zh-tw': 'Write in Traditional Chinese (繁體中文)',
    'ar': 'Write in Arabic (العربية)',
    'ru': 'Write in Russian (Русский)',
    'nl': 'Write in Dutch (Nederlands)',
    'pl': 'Write in Polish (Polski)',
    'tr': 'Write in Turkish (Türkçe)',
    'ko': 'Write in Korean (한국어)',
    'vi': 'Write in Vietnamese (Tiếng Việt)',
    'th': 'Write in Thai (ไทย)',
    'hi': 'Write in Hindi (हिन्दी)',
    'tl': 'Write in Tagalog (Tagalog)',
}

def get_meta_description_prompt(lang_code):
    """
    Get optimized meta description prompt based on language
    Focus: CTR bait, aggressive, no mixed language
    """
    prompts = {
        'id': """MINIMUM 120 chars, OPTIMAL 150-160 chars, CTR BAIT - serang pain point dengan agresif, bongkar kesalahan umum, janjikan rahasia atau solusi, gunakan bahasa provokatif seperti "membongkar kesalahan", "solusi nyata", "benar-benar berhasil", BUKAN lembut atau halus, harus memicu klik, sertakan keyword utama secara natural, TANPA TANDA KUTIP""",
        'en': """MINIMUM 120 chars, OPTIMAL 150-160 chars, CTR BAIT - attack pain point aggressively, expose common mistakes, promise to reveal secrets or solutions, use provocative language like "exposing mistakes", "real solutions", "actually works", NOT soft or gentle, must trigger click, include primary keyword naturally, NO QUOTES""",
        'es': """MINIMUM 120 caracteres, OPTIMAL 150-160 caracteres, CTR BAIT - ataca el punto de dolor agresivamente, expone errores comunes, promete revelar secretos o soluciones, usa lenguaje provocativo como "exponer errores", "soluciones reales", "realmente funciona", NO suave o gentil, debe provocar clic, incluye la palabra clave principal naturalmente, SIN COMILLAS""",
        'fr': """MINIMUM 120 caractères, OPTIMAL 150-160 caractères, CTR BAIT - attaque le point de douleur agressivement, expose les erreurs communes, promet de révéler des secrets ou solutions, utilise un langage provocateur comme "exposer les erreurs", "vraies solutions", "fonctionne vraiment", PAS doux ou gentil, doit provoquer un clic, inclut le mot-clé principal naturellement, SANS GUILLEMETS""",
        'de': """MINIMUM 120 Zeichen, OPTIMAL 150-160 Zeichen, CTR BAIT - greife den Schmerzpunkt aggressiv an, decke häufige Fehler auf, verspreche Geheimnisse oder Lösungen zu enthüllen, verwende provokative Sprache wie "Fehler aufdecken", "echte Lösungen", "funktioniert wirklich", NICHT weich oder sanft, muss Klick auslösen, schließe Hauptschlüsselwort natürlich ein, OHNE ANFÜHRUNGSZEICHEN""",
    }
    
    # Default to English if language not found
    return prompts.get(lang_code, prompts['en'])

def get_title_prompt(lang_code):
    """
    Get optimized title prompt based on language
    Focus: ONE title only, sharp/aggressive, maximize CTR
    """
    prompts = {
        'id': """Anda adalah generator judul SEO.

Buat SATU judul saja.

ATURAN KETAT:
- Title Case (kapitalkan kata penting saja)
- Buat title lengkap dan informatif (tidak ada batasan karakter - Google mengindex seluruh title)
- Tanpa tanda kutip
- Tanpa emoji
- Tanpa penjelasan
- Tanpa alternatif
- Tanpa teks tambahan
- Output HANYA judul

GAYA:
- Tajam
- Agresif
- Provokatif
- Serang pain point utama langsung
- Gunakan pertanyaan mengejutkan ATAU pernyataan berani
- BUKAN lembut
- BUKAN generik

PSIKOLOGI:
Asumsikan pembaca sudah pernah mencoba dan gagal.
Picu frustrasi, rasa ingin tahu, dan urgensi.

ATURAN KEPUTUSAN (PENTING - BACA DENGAN TELITI):
- DEFAULT: Gunakan PERNYATAAN dengan klaim berani atau mengejutkan
- Gunakan PERTANYAAN HANYA jika keyword EXPLICITLY mengandung kata negatif: gagal, failed, error, masalah, problem, kesalahan, mistake, wrong
- Contoh keyword untuk PERTANYAAN: "pola hidup sehat gagal", "investasi saham error", "belajar bahasa inggris masalah"
- Contoh keyword untuk PERNYATAAN: "tips investasi saham", "panduan belajar bahasa inggris", "cara hidup sehat", "strategi investasi"
- JIKA KEYWORD TIDAK MENGANDUNG KATA NEGATIF → GUNAKAN PERNYATAAN, BUKAN PERTANYAAN
- Jangan selalu gunakan pertanyaan - variasi penting untuk SEO

TUJUAN:
Maksimalkan CTR di hasil pencarian Google.""",
        'en': """You are an SEO title generator.

Generate ONE title only.

STRICT RULES:
- Title Case (capitalize important words only)
- Write complete, informative title (no character limit - Google indexes full title)
- No quotes
- No emojis
- No explanations
- No alternatives
- No extra text
- Output ONLY the title

STYLE:
- Sharp
- Aggressive
- Provocative
- Attack the main pain point directly
- Use shocking questions OR bold statements
- NOT soft
- NOT generic

PSYCHOLOGY:
Assume the reader has tried before and failed.
Trigger frustration, curiosity, and urgency.

DECISION RULE (IMPORTANT - READ CAREFULLY):
- DEFAULT: Use STATEMENT with bold or shocking claims
- Use QUESTION ONLY if keyword EXPLICITLY contains negative words: failed, error, problem, mistake, wrong
- Example keywords for QUESTION: "healthy lifestyle failed", "stock investment error", "learn english problem"
- Example keywords for STATEMENT: "investment tips", "learn english guide", "healthy lifestyle", "investment strategy"
- IF KEYWORD DOES NOT CONTAIN NEGATIVE WORDS → USE STATEMENT, NOT QUESTION
- Don't always use questions - variety is important for SEO

GOAL:
Maximize CTR in Google search results.""",
        'es': """Eres un generador de títulos SEO.

Genera UN SOLO título.

REGLAS ESTRICTAS:
- Title Case (capitalizar solo palabras importantes)
- Escribe título completo e informativo (sin límite de caracteres - Google indexa todo el título)
- Sin comillas
- Sin emojis
- Sin explicaciones
- Sin alternativas
- Sin texto extra
- Output SOLO el título

ESTILO:
- Agudo
- Agresivo
- Provocativo
- Ataca el punto de dolor principal directamente
- Usa preguntas impactantes O declaraciones audaces
- NO suave
- NO genérico

PSICOLOGÍA:
Asume que el lector ya lo intentó y falló.
Provoca frustración, curiosidad y urgencia.

REGLA DE DECISIÓN:
- Usa PREGUNTA SOLO si la palabra clave EXPLÍCITAMENTE contiene: fallido, error, problema, equivocado, o otras palabras negativas
- Para palabras clave informativas, tutoriales o positivas → usa DECLARACIÓN con afirmaciones audaces o impactantes
- No siempre uses preguntas - la variedad es importante para SEO

OBJETIVO:
Maximizar CTR en resultados de búsqueda de Google.""",
        'fr': """Vous êtes un générateur de titres SEO.

Génère UN SEUL titre.

RÈGLES STRICTES:
- Title Case (capitaliser uniquement les mots importants)
- Écris un titre complet et informatif (pas de limite de caractères - Google indexe tout le titre)
- Pas de guillemets
- Pas d'emojis
- Pas d'explications
- Pas d'alternatives
- Pas de texte supplémentaire
- Output UNIQUEMENT le titre

STYLE:
- Tranchant
- Agressif
- Provocateur
- Attaque le point de douleur principal directement
- Utilise des questions choquantes OU des déclarations audacieuses
- PAS doux
- PAS générique

PSYCHOLOGIE:
Suppose que le lecteur a déjà essayé et échoué.
Déclenche frustration, curiosité et urgence.

RÈGLE DE DÉCISION:
- Utilise QUESTION SEULEMENT si le mot-clé contient EXPLICITEMENT: échoué, erreur, problème, erreur, ou autres mots négatifs
- Pour les mots-clés informatifs, tutoriels ou positifs → utilise DÉCLARATION avec affirmations audacieuses ou choquantes
- N'utilise pas toujours des questions - la variété est importante pour le SEO

OBJECTIF:
Maximiser le CTR dans les résultats de recherche Google.""",
        'de': """Du bist ein SEO-Titel-Generator.

Generiere NUR EINEN Titel.

STRENGE REGELN:
- Title Case (nur wichtige Wörter großschreiben)
- Schreibe vollständigen, informativen Titel (keine Zeichenbegrenzung - Google indexiert den gesamten Titel)
- Keine Anführungszeichen
- Keine Emojis
- Keine Erklärungen
- Keine Alternativen
- Kein zusätzlicher Text
- Output NUR den Titel

STIL:
- Scharf
- Aggressiv
- Provokativ
- Greife den Hauptschmerzpunkt direkt an
- Verwende schockierende Fragen ODER kühne Aussagen
- NICHT weich
- NICHT generisch

PSYCHOLOGIE:
Nimm an, der Leser hat es bereits versucht und ist gescheitert.
Löse Frustration, Neugier und Dringlichkeit aus.

ENTSCHEIDUNGSREGEL:
- Verwende FRAGE NUR wenn das Schlüsselwort EXPLIZIT enthält: gescheitert, Fehler, Problem, falsch oder andere negative Wörter
- Für informative, Tutorial- oder positive Schlüsselwörter → verwende AUSSAGE mit kühnen oder schockierenden Behauptungen
- Verwende nicht immer Fragen - Abwechslung ist wichtig für SEO

ZIEL:
CTR in Google-Suchergebnissen maximieren.""",
    }
    
    # Default to English if language not found
    return prompts.get(lang_code, prompts['en'])

def parse_delimiter_text(content):
    """
    Parse delimiter text format to dictionary
    Supports both formats:
    1. Plain delimiter: TITLE: value
    2. Markdown: **TITLE:** value
    
    Format:
    TITLE: value
    META_DESCRIPTION: value
    KEYWORDS: value1, value2
    H1: value
    OPENING_PARAGRAPH: value
    ---
    SECTION:
    H2: value
    PARAGRAPH: value
    PARAGRAPH: value
    ---
    RELATED_TOPIC:
    TITLE: value
    DESCRIPTION: value
    ---
    """
    result = {
        'title': '',
        'meta_description': '',
        'keywords': '',
        'h1': '',
        'opening_paragraph': '',
        'sections': [],
        'related_topics': []
    }
    
    # Remove markdown formatting if present (**KEY:** -> KEY:)
    # But preserve the content
    content_cleaned = content
    # Pattern: **KEY:** value -> KEY: value (markdown on left only)
    content_cleaned = re.sub(r'\*\*([A-Z_]+):\*\*', r'\1:', content_cleaned)
    # Pattern: **KEY: value** -> KEY: value (markdown on both sides, like **SECTION: Introduction**)
    content_cleaned = re.sub(r'\*\*([A-Z_]+):\s*([^*]+)\*\*', r'\1: \2', content_cleaned)
    # Also handle **KEY:** at start of line
    content_cleaned = re.sub(r'^\*\*([A-Z_]+):\*\*', r'\1:', content_cleaned, flags=re.MULTILINE)
    
    lines = content_cleaned.split('\n')
    current_section = None
    current_related_topic = None
    in_section_content = False
    in_related_topic = False
    
    for line in lines:
        original_line = line
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        # Check for delimiter
        if line.startswith('---'):
            if current_section:
                if current_section.get('h2') and current_section.get('paragraphs'):
                    result['sections'].append(current_section)
                current_section = None
                in_section_content = False
            if current_related_topic:
                if current_related_topic.get('title') and current_related_topic.get('description'):
                    result['related_topics'].append(current_related_topic)
                current_related_topic = None
                in_related_topic = False
            continue
        
        # Parse key-value pairs
        if ':' in line:
            # Handle markdown format: **KEY:** value or **KEY: value**
            # Try to match **KEY: value** first (markdown on both sides)
            markdown_both_match = re.match(r'\*\*([A-Z_]+):\s*([^*]+)\*\*', line)
            if markdown_both_match:
                key = markdown_both_match.group(1).upper()
                value = markdown_both_match.group(2).strip()
            # Try **KEY:** value (markdown on left only)
            elif line.startswith('**') and ':**' in line:
                # Handle markdown format: **KEY:** value or **Meta Description:** value (with spaces)
                markdown_left_match = re.match(r'\*\*([A-Za-z_\s]+):\*\*\s*(.*)', line, re.IGNORECASE)
                if markdown_left_match:
                    key = markdown_left_match.group(1).upper().replace(' ', '_')
                    value = markdown_left_match.group(2).strip()
                else:
                    # Fallback: try to split normally
                    key, value = line.split(':', 1)
                    key = key.strip().upper().replace('**', '').replace('*', '').replace(' ', '_')
                    value = value.strip().replace('**', '').replace('*', '')
            elif ':' in line and not line.strip().startswith('---'):
                # Normal format: KEY: value (also handle "Meta Description:" with space)
                # Handle both "META_DESCRIPTION:" and "Meta Description:" formats
                key, value = line.split(':', 1)
                key = key.strip().upper().replace(' ', '_').replace('**', '').replace('*', '')
                value = value.strip().replace('**', '').replace('*', '')
            else:
                # Skip lines without colon (will be handled as content later)
                continue
            
            # Remove any remaining markdown formatting from value
            value = re.sub(r'\*\*', '', value).strip()
            
            if key == 'TITLE' and not result['title'] and not current_related_topic:
                # Remove quotes from title for SEO optimization
                result['title'] = value.strip('"').strip("'").strip()
            elif key == 'META_DESCRIPTION' and not result['meta_description']:
                # Remove quotes from meta description for SEO optimization
                result['meta_description'] = value.strip('"').strip("'").strip()
            elif key == 'KEYWORDS' and not result['keywords']:
                result['keywords'] = value
            elif key == 'H1' and not result['h1']:
                result['h1'] = value
            elif key == 'OPENING_PARAGRAPH' and not result['opening_paragraph']:
                result['opening_paragraph'] = value
            elif key == 'OPENING_PARAGRAPH' and result['opening_paragraph']:
                # Append jika ada multiple lines
                result['opening_paragraph'] += ' ' + value
            elif key == 'SECTION':
                if current_section and current_section.get('h2') and current_section.get('paragraphs'):
                    result['sections'].append(current_section)
                # Support both formats:
                # - SECTION: Introduction (new format - name directly)
                # - SECTION: (old format - needs H2:)
                if value:
                    # New format: SECTION: Introduction
                    current_section = {'h2': value, 'paragraphs': []}
                    in_section_content = True
                else:
                    # Old format: SECTION: (needs H2: later)
                    current_section = {'h2': '', 'paragraphs': []}
                    in_section_content = False
            elif key == 'H2' and current_section:
                current_section['h2'] = value
                in_section_content = True
            elif key == 'PARAGRAPH' and current_section:
                if value:
                    current_section['paragraphs'].append(value)
            elif key == 'RELATED_TOPIC' or key == 'RELATED TOPIC' or key == 'RELATED_TOPICS':
                # More lenient: allow related topic with just title (description can be generated from title later)
                if current_related_topic and current_related_topic.get('title'):
                    # If description is missing, we'll generate it from title later (OPSI 3)
                    if not current_related_topic.get('description'):
                        current_related_topic['description'] = ''  # Will be generated from title
                    result['related_topics'].append(current_related_topic)
                current_related_topic = {'title': '', 'description': ''}
                in_related_topic = True
                # Handle case where RELATED_TOPIC:** is followed by title on next line (Ollama format)
                if not value or value.strip() == '' or value.strip() == '**':
                    # Title will be on next line, wait for it
                    pass
                else:
                    # Title might be in value
                    if value and not value.startswith('TITLE:') and not value.startswith('DESCRIPTION:'):
                        # This might be the title directly
                        current_related_topic['title'] = value.strip('**').strip()
            elif key == 'TITLE' and current_related_topic:
                current_related_topic['title'] = value
            elif key == 'DESCRIPTION' and current_related_topic:
                current_related_topic['description'] = value
        else:
            # Line without colon - could be paragraph content in section
            if current_section and in_section_content and line:
                # This is paragraph content for current section
                # Remove any markdown formatting
                line_clean = re.sub(r'\*\*', '', line).strip()
                if line_clean:
                    if current_section.get('paragraphs'):
                        # Append to last paragraph if it exists
                        current_section['paragraphs'][-1] += ' ' + line_clean
                    else:
                        # Start new paragraph
                        current_section['paragraphs'].append(line_clean)
            elif current_related_topic and in_related_topic and line:
                # Handle markdown format: **TITLE:** or **DESCRIPTION:**
                markdown_title_match = re.match(r'\*\*TITLE:\*\*\s*(.*)', line, re.IGNORECASE)
                markdown_desc_match = re.match(r'\*\*DESCRIPTION:\*\*\s*(.*)', line, re.IGNORECASE)
                
                if markdown_title_match:
                    # Found **TITLE:** format
                    current_related_topic['title'] = markdown_title_match.group(1).strip()
                elif markdown_desc_match:
                    # Found **DESCRIPTION:** format
                    current_related_topic['description'] = markdown_desc_match.group(1).strip()
                else:
                    # This might be title or description content (more robust extraction)
                    line_clean = re.sub(r'\*\*', '', line).strip()
                    # Remove common prefixes that might be added by AI
                    line_clean = re.sub(r'^(Title:|TITLE:|Description:|DESCRIPTION:)\s*', '', line_clean, flags=re.IGNORECASE)
                    
                    # Skip empty lines and separators
                    if not line_clean or line_clean == '---' or line_clean.startswith('RELATED_TOPIC'):
                        continue
                    
                    # If title is empty, this line is likely the title
                    if not current_related_topic.get('title'):
                        current_related_topic['title'] = line_clean
                    else:
                        # This is description content - only append if description is empty
                        # Don't append if description already exists (avoid duplication)
                        if not current_related_topic.get('description') or current_related_topic.get('description', '').strip() == '':
                            current_related_topic['description'] = line_clean
                        # Don't append if description already exists to avoid duplication
    
    # Add last section/topic if exists
    if current_section and current_section.get('h2') and current_section.get('paragraphs'):
        result['sections'].append(current_section)
    # More lenient: allow related topic with just title (description can be generated from title later)
    if current_related_topic and current_related_topic.get('title'):
        # If description is missing, we'll generate it from title later (OPSI 3)
        if not current_related_topic.get('description'):
            current_related_topic['description'] = ''  # Will be generated from title
        result['related_topics'].append(current_related_topic)
    
    return result

def get_ollama_content(keyword, lang_instruction):
    """
    Generate SEO-optimized content dari Ollama (Local AI)
    Using delimiter text format for more reliable parsing
    """
    # Get optimized title and meta description prompts based on language
    detected_lang = detect_language(keyword)
    title_prompt = get_title_prompt(detected_lang)
    meta_desc_prompt = get_meta_description_prompt(detected_lang)
    
    prompt = f"""SEO article "{keyword}". {lang_instruction}. Return content in this format (no JSON, no markdown):

TITLE: {title_prompt}
META_DESCRIPTION: {meta_desc_prompt}
KEYWORDS: keyword, related1, related2, related3, related4, related5, related6 (MUST include 5-7 related keywords, comma-separated)
H1: Title Case (capitalize important words), include keyword, specific and compelling (NOT generic), include benefit or value proposition
OPENING_PARAGRAPH: 80-100 words, keyword 1-2x, engaging introduction
---
SECTION: [Generate H2 heading that is relevant to keyword, natural, SEO-friendly, and includes keyword or related terms. Make it specific to the topic, NOT generic like "Introduction" or "Main Content". Examples: "Understanding {keyword}", "How to Maximize {keyword}", "Key Features of {keyword}", "Tips for {keyword}", "Best Practices for {keyword}"]
Comprehensive content that covers this specific aspect of the topic naturally.
---
SECTION: [Generate another H2 heading relevant to keyword, different from previous, natural and SEO-friendly]
Deep analysis and insights about this specific aspect.
---
SECTION: [Generate another H2 heading relevant to keyword, different from previous, natural and SEO-friendly]
Practical information and real-world applications for this aspect.
---
SECTION: [Generate another H2 heading relevant to keyword, different from previous, natural and SEO-friendly]
Additional insights, tips, or strategies related to this aspect.
---
SECTION: [Generate final H2 heading relevant to keyword, natural and SEO-friendly, can be summary or conclusion]
Neutral, authoritative wrap-up that reinforces understanding without promotion.
---
RELATED_TOPIC:
TITLE: [Generate a closely related topic title that is relevant to "{keyword}", natural, SEO-friendly, and includes keyword or related terms. Make it specific, NOT generic.]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) that explains what this related topic covers, why it's relevant, and what value it provides. Include keyword naturally. Make it SEO-friendly and compelling.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]

CRITICAL: You MUST generate EXACTLY 6 RELATED_TOPIC sections. Each MUST have both TITLE and DESCRIPTION. Do NOT skip any RELATED_TOPIC sections.
---

Write comprehensive, detailed content. Target 900-1200 words total. Use this exact format, no JSON, no markdown."""
    
    system_prompt = f"""You are an elite hybrid SEO content system.
Your function combines fast-ranking optimization with stealth editorial delivery.

CRITICAL LANGUAGE RULE:
- Write EXCLUSIVELY in {lang_instruction}
- Do NOT mix languages
- Do NOT use words from other languages
- All content (title, description, paragraphs, sections) MUST be in {lang_instruction} only
- If you cannot find a word in {lang_instruction}, use a synonym in the same language

PRIMARY OBJECTIVE:
- Rank quickly using semantic dominance and intent satisfaction.
- Blend naturally into high-trust or parasite host environments.
- Avoid detectable SEO footprints or mechanical patterns.

CONTENT STRATEGY:
- Write as an authoritative editorial resource, not an SEO article.
- Front-load topical authority subtly within natural context.
- Use entities, related concepts, and synonyms implicitly.
- Do NOT repeat keywords mechanically.
- Optimize for search intent first, algorithms second.

CONTENT REQUIREMENTS:
- Total length: 900-1200 words.
- High semantic coverage without obvious optimization.
- Clear topical focus with natural narrative flow.
- Strong informational depth exceeding competitors.
- No promotional tone, no calls to action.

STEALTH RULES:
- Do not mention SEO, ranking, traffic, or optimization.
- Avoid formulaic intros or conclusions.
- Vary sentence length and structure to avoid AI patterns.
- Write as if published on an established authority site.

FAST RANK RULES:
- Establish topical relevance within the first 150 words.
- Answer primary and secondary intents implicitly.
- Include explanatory depth, mechanisms, and real-world context.
- Support potential featured snippet extraction naturally.

STRICT FORMAT RULES (ABSOLUTE):
- Output ONLY using the exact delimiter structure shown.
- Use plain text only.
- Do NOT use markdown.
- Do NOT use JSON.
- Do NOT use bullets, numbering, or tables.
- Do NOT add, rename, or reorder sections.
- Do NOT add commentary or explanations."""
    
    # Combine system prompt and user prompt more clearly
    full_prompt = f"{system_prompt}\n\n{prompt}\n\nIMPORTANT: Follow the format EXACTLY. Use SECTION: and RELATED_TOPIC: as shown. Do not use markdown formatting."
    
    try:
        print(f"🤖 Generating content dengan Ollama ({OLLAMA_MODEL}) untuk: {keyword}")
        
        # Call Ollama API
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 2500,  # Increased untuk complete content + 6 related topics
                }
            },
            timeout=900  # 15 minutes timeout
        )
        
        if response.status_code != 200:
            print(f"❌ Ollama API error: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
        
        result_data = response.json()
        content = result_data.get('response', '').strip()
        
        if not content:
            print("❌ Empty response from Ollama")
            return None
        
        # Debug: print content untuk troubleshooting
        print(f"📝 Raw content preview (first 800 chars):\n{content[:800]}\n")
        
        # Debug: check if RELATED_TOPIC exists in content
        if 'RELATED_TOPIC' in content or 'Related Topic' in content or 'related topic' in content.lower():
            print("✅ RELATED_TOPIC found in raw content")
            # Show RELATED_TOPIC section
            related_match = re.search(r'RELATED_TOPIC.*?(?=RELATED_TOPIC|$)', content, re.DOTALL | re.IGNORECASE)
            if related_match:
                print(f"📋 First RELATED_TOPIC preview:\n{related_match.group(0)[:300]}\n")
        else:
            print("⚠️  RELATED_TOPIC NOT found in raw content - AI mungkin tidak generate")
            # Show last 500 chars to see what AI generated
            print(f"📋 Last 500 chars of content:\n{content[-500:]}\n")
        
        # Parse delimiter text format
        result = parse_delimiter_text(content)
        
        # Validate required fields
        if not result.get('title'):
            result['title'] = keyword
        if not result.get('meta_description'):
            # Generate natural, SEO-friendly meta description based on language
            detected_lang = detect_language(keyword)
            if detected_lang == 'id':
                result['meta_description'] = f"Temukan panduan lengkap tentang {keyword} dan pelajari strategi praktis untuk mencapai hasil terbaik."
            else:
                result['meta_description'] = f"Discover comprehensive guide about {keyword} and learn practical strategies to achieve the best results."
        if not result.get('keywords'):
            result['keywords'] = keyword
        
        # H1 = TITLE (konsistensi keyword untuk SEO)
        # Simpan H1 AI sebelum di-overwrite untuk digabung ke opening paragraph
        h1_ai = result.get('h1', '')
        title_ai = result.get('title', '')
        
        # Pilih yang lebih powerful antara TITLE dan H1 AI untuk digunakan sebagai TITLE dan H1
        # H1 AI biasanya lebih descriptive/powerful, jadi prioritaskan H1 AI jika lebih panjang/powerful
        if h1_ai and title_ai:
            # Compare: pilih yang lebih panjang dan powerful
            # H1 AI biasanya lebih descriptive, jadi jika lebih panjang, gunakan H1 AI
            if len(h1_ai) > len(title_ai) and len(h1_ai) > 30:
                # H1 AI lebih panjang dan powerful, gunakan sebagai TITLE dan H1
                result['title'] = h1_ai
                result['h1'] = h1_ai
            else:
                # TITLE AI lebih powerful atau sama, gunakan TITLE AI
                result['h1'] = title_ai
        elif h1_ai:
            # Hanya H1 AI yang ada, gunakan sebagai TITLE dan H1
            result['title'] = h1_ai
            result['h1'] = h1_ai
        elif title_ai:
            # Hanya TITLE AI yang ada, gunakan sebagai TITLE dan H1
            result['h1'] = title_ai
        else:
            # Tidak ada keduanya, gunakan keyword
            result['title'] = keyword
            result['h1'] = keyword
        
        # Opening paragraph = H1 AI + Opening paragraph AI (jika ada)
        opening_ai = result.get('opening_paragraph', '')
        if h1_ai and opening_ai:
            # Gabungkan H1 AI + Opening paragraph AI
            result['opening_paragraph'] = f"{h1_ai}. {opening_ai}"
        elif h1_ai and not opening_ai:
            # Hanya H1 AI yang ada, gunakan sebagai opening
            result['opening_paragraph'] = h1_ai
        elif not opening_ai:
            # Tidak ada H1 AI dan opening AI, gunakan fallback
            if result.get('meta_description'):
                result['opening_paragraph'] = result['meta_description']
            else:
                # Natural opening variations based on language
                detected_lang = detect_language(keyword)
                if detected_lang == 'id':
                    result['opening_paragraph'] = f"Pelajari lebih lanjut tentang {keyword} dan temukan strategi yang efektif untuk mencapai hasil terbaik."
                else:
                    result['opening_paragraph'] = f"Discover how {keyword} can help you achieve better results with proven strategies and expert insights."
        if not result.get('sections'):
            result['sections'] = []
        if not result.get('related_topics'):
            result['related_topics'] = []
        
        # OPSI 3: Generate description from title if DESCRIPTION is missing (natural fallback)
        detected_lang = detect_language(keyword)
        for topic in result['related_topics']:
            # Only generate if description is truly empty or missing
            description = topic.get('description', '').strip()
            title = topic.get('title', '').strip()
            
            # Truncate description if too long (max 150 chars for SEO)
            if description and len(description) > 150:
                # Smart truncation at word boundary
                words = description.split()
                truncated = []
                for word in words:
                    if len(' '.join(truncated + [word])) <= 147:
                        truncated.append(word)
                    else:
                        break
                description = ' '.join(truncated)
                if len(description) < len(topic.get('description', '')):
                    description += '...'
                topic['description'] = description
            
            if title and not description:
                # Generate concise, natural description from title (40-60 words, SEO-friendly)
                # Extract key phrase from title (first 5-7 words max)
                title_words = title.split()[:7]
                title_short = ' '.join(title_words)
                
                if detected_lang == 'id':
                    # More concise and natural Indonesian description (max 150 chars)
                    topic['description'] = f"Pelajari lebih lanjut tentang {title_short} dan temukan strategi praktis yang dapat membantu Anda."
                else:
                    # More concise and natural English description (max 150 chars)
                    topic['description'] = f"Learn more about {title_short} and discover practical strategies that can help you."
                
                # Ensure description is not too long
                if len(topic['description']) > 150:
                    topic['description'] = topic['description'][:147] + '...'
        
        # If no related topics at all, generate default ones based on keyword
        if not result['related_topics']:
            print("⚠️  No related topics found, generating default related topics")
            if detected_lang == 'id':
                # Generate Indonesian related topics
                result['related_topics'] = [
                    {'title': f'Panduan Lengkap tentang {keyword}', 'description': f'Pelajari lebih lanjut tentang {keyword} dan berbagai aspek penting yang perlu diketahui.'},
                    {'title': f'Tips dan Strategi untuk {keyword}', 'description': f'Dapatkan tips dan strategi praktis untuk memaksimalkan pengalaman dengan {keyword}.'},
                    {'title': f'Faktor Penting dalam {keyword}', 'description': f'Pahami faktor-faktor penting yang mempengaruhi kesuksesan dalam {keyword}.'},
                    {'title': f'Cara Memulai dengan {keyword}', 'description': f'Pelajari langkah-langkah awal untuk memulai perjalanan Anda dengan {keyword}.'},
                    {'title': f'Kesalahan Umum dalam {keyword}', 'description': f'Hindari kesalahan umum yang sering dilakukan dalam {keyword}.'},
                    {'title': f'Manfaat dan Keuntungan {keyword}', 'description': f'Temukan berbagai manfaat dan keuntungan yang bisa didapat dari {keyword}.'}
                ]
            else:
                # Generate English related topics
                result['related_topics'] = [
                    {'title': f'Complete Guide to {keyword}', 'description': f'Learn more about {keyword} and important aspects you need to know.'},
                    {'title': f'Tips and Strategies for {keyword}', 'description': f'Get practical tips and strategies to maximize your experience with {keyword}.'},
                    {'title': f'Important Factors in {keyword}', 'description': f'Understand important factors that influence success in {keyword}.'},
                    {'title': f'How to Get Started with {keyword}', 'description': f'Learn the initial steps to start your journey with {keyword}.'},
                    {'title': f'Common Mistakes in {keyword}', 'description': f'Avoid common mistakes often made in {keyword}.'},
                    {'title': f'Benefits and Advantages of {keyword}', 'description': f'Discover various benefits and advantages you can gain from {keyword}.'}
                ]
        
        # Convert keywords string to list if needed
        if isinstance(result.get('keywords'), str):
            keywords_list = [k.strip() for k in result['keywords'].split(',')]
            result['keywords'] = keywords_list
        
        # Calculate tokens (estimate)
        input_tokens = len(prompt.split()) * 1.3
        output_tokens = len(content.split()) * 1.3
        total_tokens = int(input_tokens + output_tokens)
        
        result['cost'] = 0.0  # FREE with local AI
        result['tokens'] = {
            'input': int(input_tokens),
            'output': int(output_tokens),
            'total': total_tokens
        }
        
        print(f"✅ Content generated! Tokens: {int(input_tokens):,} input + {int(output_tokens):,} output = {total_tokens:,} total")
        print(f"   Cost: $0.00 (FREE - Local AI)")
        return result
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Ollama connection error: {e}")
        print(f"   Make sure Ollama is running: brew services start ollama")
        return None
    except Exception as e:
        print(f"❌ Error parsing delimiter text: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_ai_content(keyword):
    """
    Generate SEO-optimized content dari AI (OpenAI atau Ollama)
    Using delimiter text format for more reliable parsing
    """
    lang_code = detect_language(keyword)
    lang_instruction = lang_instruction_map.get(lang_code, "Write in English")
    
    # Select AI service
    if AI_SERVICE == 'ollama' and OLLAMA_AVAILABLE:
        return get_ollama_content(keyword, lang_instruction)
    elif AI_SERVICE == 'openai' and OPENAI_AVAILABLE:
        # Get optimized title and meta description prompts based on language
        detected_lang = detect_language(keyword)
        title_prompt = get_title_prompt(detected_lang)
        meta_desc_prompt = get_meta_description_prompt(detected_lang)
        
        prompt = f"""SEO article "{keyword}". {lang_instruction}. Return content in this format (no JSON, no markdown):

TITLE: {title_prompt}
META_DESCRIPTION: {meta_desc_prompt}
KEYWORDS: keyword, related1, related2, related3, related4, related5, related6 (MUST include 5-7 related keywords, comma-separated)
H1: Title Case (capitalize important words), include keyword, specific and compelling (NOT generic), include benefit or value proposition
OPENING_PARAGRAPH: 80-100 words, keyword 1-2x, engaging introduction
---
SECTION: [Generate H2 heading that is relevant to keyword, natural, SEO-friendly, and includes keyword or related terms. Make it specific to the topic, NOT generic like "Introduction" or "Main Content". Examples: "Understanding {keyword}", "How to Maximize {keyword}", "Key Features of {keyword}", "Tips for {keyword}", "Best Practices for {keyword}"]
Comprehensive content that covers this specific aspect of the topic naturally.
---
SECTION: [Generate another H2 heading relevant to keyword, different from previous, natural and SEO-friendly]
Deep analysis and insights about this specific aspect.
---
SECTION: [Generate another H2 heading relevant to keyword, different from previous, natural and SEO-friendly]
Practical information and real-world applications for this aspect.
---
SECTION: [Generate another H2 heading relevant to keyword, different from previous, natural and SEO-friendly]
Additional insights, tips, or strategies related to this aspect.
---
SECTION: [Generate final H2 heading relevant to keyword, natural and SEO-friendly, can be summary or conclusion]
Neutral, authoritative wrap-up that reinforces understanding without promotion.
---
RELATED_TOPIC:
TITLE: [Generate a closely related topic title that is relevant to "{keyword}", natural, SEO-friendly, and includes keyword or related terms. Make it specific, NOT generic.]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) that explains what this related topic covers, why it's relevant, and what value it provides. Include keyword naturally. Make it SEO-friendly and compelling.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]
---
RELATED_TOPIC:
TITLE: [Generate another closely related topic title, different from previous, relevant to "{keyword}", natural and SEO-friendly]
DESCRIPTION: [Generate a natural, engaging description (40-60 words) for this related topic. Include keyword naturally.]

CRITICAL: You MUST generate EXACTLY 6 RELATED_TOPIC sections. Each MUST have both TITLE and DESCRIPTION. Do NOT skip any RELATED_TOPIC sections.
---

Write comprehensive, detailed content. Target 900-1200 words total. Use this exact format, no JSON, no markdown."""
        
        system_prompt = f"""You are an elite hybrid SEO content system.
Your function combines fast-ranking optimization with stealth editorial delivery.

CRITICAL LANGUAGE RULE:
- Write EXCLUSIVELY in {lang_instruction}
- Do NOT mix languages
- Do NOT use words from other languages
- All content (title, description, paragraphs, sections) MUST be in {lang_instruction} only
- If you cannot find a word in {lang_instruction}, use a synonym in the same language

PRIMARY OBJECTIVE:
- Rank quickly using semantic dominance and intent satisfaction.
- Blend naturally into high-trust or parasite host environments.
- Avoid detectable SEO footprints or mechanical patterns.

CONTENT STRATEGY:
- Write as an authoritative editorial resource, not an SEO article.
- Front-load topical authority subtly within natural context.
- Use entities, related concepts, and synonyms implicitly.
- Do NOT repeat keywords mechanically.
- Optimize for search intent first, algorithms second.

CONTENT REQUIREMENTS:
- Total length: 900-1200 words.
- High semantic coverage without obvious optimization.
- Clear topical focus with natural narrative flow.
- Strong informational depth exceeding competitors.
- No promotional tone, no calls to action.

STEALTH RULES:
- Do not mention SEO, ranking, traffic, or optimization.
- Avoid formulaic intros or conclusions.
- Vary sentence length and structure to avoid AI patterns.
- Write as if published on an established authority site.

FAST RANK RULES:
- Establish topical relevance within the first 150 words.
- Answer primary and secondary intents implicitly.
- Include explanatory depth, mechanisms, and real-world context.
- Support potential featured snippet extraction naturally.

STRICT FORMAT RULES (ABSOLUTE):
- Output ONLY using the exact delimiter structure shown.
- Use plain text only.
- Do NOT use markdown.
- Do NOT use JSON.
- Do NOT use bullets, numbering, or tables.
- Do NOT add, rename, or reorder sections.
- Do NOT add commentary or explanations."""
        
        try:
            print(f"🤖 Generating content dengan OpenAI ({OPENAI_MODEL}) untuk: {keyword}")
            
            # Call OpenAI API
            response = openai.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000  # Increased untuk complete content (sections + related topics)
            )
            
            content = response.choices[0].message.content.strip()
            
            if not content:
                print("❌ Empty response from OpenAI")
                return None
            
            # Debug: print content untuk troubleshooting
            print(f"📝 Raw content preview (first 800 chars):\n{content[:800]}\n")
            
            # Parse delimiter text format
            result = parse_delimiter_text(content)
            
            # Validate required fields
            if not result.get('title'):
                result['title'] = keyword
            
            # Validate meta description length
            if not result.get('meta_description'):
                # Generate natural, SEO-friendly meta description based on language
                detected_lang = detect_language(keyword)
                if detected_lang == 'id':
                    result['meta_description'] = f"Temukan panduan lengkap tentang {keyword} dan pelajari strategi praktis untuk mencapai hasil terbaik."
                else:
                    result['meta_description'] = f"Discover comprehensive guide about {keyword} and learn practical strategies to achieve the best results."
            else:
                # AI should generate 150-160 chars (minimum 120 chars) - keep as-is
                # Only truncate if too long (> 160 chars)
                meta_desc = result['meta_description']
                if len(meta_desc) > 160:
                    # Truncate to 160 chars, but try to cut at word boundary
                    truncated = meta_desc[:160]
                    last_space = truncated.rfind(' ')
                    if last_space >= 155:  # Space at position 155-160
                        result['meta_description'] = truncated[:last_space]
                    elif last_space >= 150:  # Space at position 150-155
                        result['meta_description'] = truncated[:last_space]
                    else:
                        result['meta_description'] = truncated
            
            # Validate keywords - generate related keywords if missing or too few
            if not result.get('keywords'):
                # Generate related keywords from keyword
                keyword_lower = keyword.lower()
                related_keywords = [
                    keyword,
                    f"{keyword} guide",
                    f"{keyword} tips",
                    f"best {keyword}",
                    f"{keyword} strategies",
                    f"how to {keyword}",
                    f"{keyword} advice"
                ]
                result['keywords'] = ', '.join(related_keywords[:7])
            else:
                # Ensure minimum 5 keywords
                keywords_list = [k.strip() for k in result['keywords'].split(',') if k.strip()]
                if len(keywords_list) < 5:
                    # Add related keywords
                    keyword_lower = keyword.lower()
                    additional_keywords = [
                        f"{keyword} guide",
                        f"{keyword} tips",
                        f"best {keyword}",
                        f"{keyword} strategies"
                    ]
                    # Add unique keywords
                    for add_kw in additional_keywords:
                        if add_kw not in keywords_list:
                            keywords_list.append(add_kw)
                        if len(keywords_list) >= 7:
                            break
                    result['keywords'] = ', '.join(keywords_list[:7])
            
            # H1 = TITLE (konsistensi keyword untuk SEO)
            # Simpan H1 AI sebelum di-overwrite untuk digabung ke opening paragraph
            h1_ai = result.get('h1', '')
            title_ai = result.get('title', '')
            
            # Pilih yang lebih powerful antara TITLE dan H1 AI untuk digunakan sebagai TITLE dan H1
            # H1 AI biasanya lebih descriptive/powerful, jadi prioritaskan H1 AI jika lebih panjang/powerful
            if h1_ai and title_ai:
                # Compare: pilih yang lebih panjang dan powerful
                # H1 AI biasanya lebih descriptive, jadi jika lebih panjang, gunakan H1 AI
                if len(h1_ai) > len(title_ai) and len(h1_ai) > 30:
                    # H1 AI lebih panjang dan powerful, gunakan sebagai TITLE dan H1
                    result['title'] = h1_ai
                    result['h1'] = h1_ai
                else:
                    # TITLE AI lebih powerful atau sama, gunakan TITLE AI
                    result['h1'] = title_ai
            elif h1_ai:
                # Hanya H1 AI yang ada, gunakan sebagai TITLE dan H1
                result['title'] = h1_ai
                result['h1'] = h1_ai
            elif title_ai:
                # Hanya TITLE AI yang ada, gunakan sebagai TITLE dan H1
                result['h1'] = title_ai
            else:
                # Tidak ada keduanya, gunakan keyword
                result['title'] = keyword
                result['h1'] = keyword
            
            # Opening paragraph = H1 AI + Opening paragraph AI (jika ada)
            opening_ai = result.get('opening_paragraph', '')
            if h1_ai and opening_ai:
                # Gabungkan H1 AI + Opening paragraph AI
                result['opening_paragraph'] = f"{h1_ai}. {opening_ai}"
            elif h1_ai and not opening_ai:
                # Hanya H1 AI yang ada, gunakan sebagai opening
                result['opening_paragraph'] = h1_ai
            elif not opening_ai:
                # Tidak ada H1 AI dan opening AI, gunakan fallback
                if result.get('meta_description'):
                    result['opening_paragraph'] = result['meta_description']
                else:
                    # Natural opening variations based on language
                    detected_lang = detect_language(keyword)
                    if detected_lang == 'id':
                        result['opening_paragraph'] = f"Pelajari lebih lanjut tentang {keyword} dan temukan strategi yang efektif untuk mencapai hasil terbaik."
                    else:
                        result['opening_paragraph'] = f"Discover how {keyword} can help you achieve better results with proven strategies and expert insights."
            if not result.get('sections'):
                result['sections'] = []
            if not result.get('related_topics'):
                result['related_topics'] = []
            
            # OPSI 3: Generate description from title if DESCRIPTION is missing (natural fallback)
            detected_lang = detect_language(keyword)
            for topic in result['related_topics']:
                # Only generate if description is truly empty or missing
                description = topic.get('description', '').strip()
                title = topic.get('title', '').strip()
                
                # Truncate description if too long (max 150 chars for SEO)
                if description and len(description) > 150:
                    # Smart truncation at word boundary
                    words = description.split()
                    truncated = []
                    for word in words:
                        if len(' '.join(truncated + [word])) <= 147:
                            truncated.append(word)
                        else:
                            break
                    description = ' '.join(truncated)
                    if len(description) < len(topic.get('description', '')):
                        description += '...'
                    topic['description'] = description
                
                if title and not description:
                    # Generate concise, natural description from title (40-60 words, SEO-friendly)
                    # Extract key phrase from title (first 5-7 words max)
                    title_words = title.split()[:7]
                    title_short = ' '.join(title_words)
                    
                    if detected_lang == 'id':
                        # More concise and natural Indonesian description (max 150 chars)
                        topic['description'] = f"Pelajari lebih lanjut tentang {title_short} dan temukan strategi praktis yang dapat membantu Anda."
                    else:
                        # More concise and natural English description (max 150 chars)
                        topic['description'] = f"Learn more about {title_short} and discover practical strategies that can help you."
                    
                    # Ensure description is not too long
                    if len(topic['description']) > 150:
                        topic['description'] = topic['description'][:147] + '...'
            
            # If no related topics at all, generate default ones based on keyword
            if not result['related_topics']:
                print("⚠️  No related topics found, generating default related topics")
                if detected_lang == 'id':
                    # Generate Indonesian related topics
                    result['related_topics'] = [
                        {'title': f'Panduan Lengkap tentang {keyword}', 'description': f'Pelajari lebih lanjut tentang {keyword} dan berbagai aspek penting yang perlu diketahui.'},
                        {'title': f'Tips dan Strategi untuk {keyword}', 'description': f'Dapatkan tips dan strategi praktis untuk memaksimalkan pengalaman dengan {keyword}.'},
                        {'title': f'Faktor Penting dalam {keyword}', 'description': f'Pahami faktor-faktor penting yang mempengaruhi kesuksesan dalam {keyword}.'},
                        {'title': f'Cara Memulai dengan {keyword}', 'description': f'Pelajari langkah-langkah awal untuk memulai perjalanan Anda dengan {keyword}.'},
                        {'title': f'Kesalahan Umum dalam {keyword}', 'description': f'Hindari kesalahan umum yang sering dilakukan dalam {keyword}.'},
                        {'title': f'Manfaat dan Keuntungan {keyword}', 'description': f'Temukan berbagai manfaat dan keuntungan yang bisa didapat dari {keyword}.'}
                    ]
                else:
                    # Generate English related topics
                    result['related_topics'] = [
                        {'title': f'Complete Guide to {keyword}', 'description': f'Learn more about {keyword} and important aspects you need to know.'},
                        {'title': f'Tips and Strategies for {keyword}', 'description': f'Get practical tips and strategies to maximize your experience with {keyword}.'},
                        {'title': f'Important Factors in {keyword}', 'description': f'Understand important factors that influence success in {keyword}.'},
                        {'title': f'How to Get Started with {keyword}', 'description': f'Learn the initial steps to start your journey with {keyword}.'},
                        {'title': f'Common Mistakes in {keyword}', 'description': f'Avoid common mistakes often made in {keyword}.'},
                        {'title': f'Benefits and Advantages of {keyword}', 'description': f'Discover various benefits and advantages you can get from {keyword}.'}
                    ]
            
            # Convert keywords string to list if needed
            if isinstance(result.get('keywords'), str):
                keywords_list = [k.strip() for k in result['keywords'].split(',')]
                result['keywords'] = keywords_list
            
            # Calculate tokens and cost
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            total_tokens = response.usage.total_tokens
            
            # Cost calculation for GPT-4o-mini
            input_cost = (input_tokens / 1_000_000) * 0.15  # $0.15 per 1M input tokens
            output_cost = (output_tokens / 1_000_000) * 0.60  # $0.60 per 1M output tokens
            total_cost = input_cost + output_cost
            
            result['cost'] = total_cost
            result['tokens'] = {
                'input': input_tokens,
                'output': output_tokens,
                'total': total_tokens
            }
            
            print(f"✅ Content generated! Tokens: {input_tokens:,} input + {output_tokens:,} output = {total_tokens:,} total")
            print(f"   Cost: ${total_cost:.6f} (${input_cost:.6f} input + ${output_cost:.6f} output)")
            return result
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    print("❌ No AI service available. Install openai or configure Ollama")
    return None

def generate_breadcrumbs(keyword, base_url):
    """Generate breadcrumbs HTML"""
    safe_keyword = re.sub(r'[^a-z0-9]+', '-', keyword.lower())
    breadcrumbs = f"""<ol>
            <li><a href="{base_url}">Home</a></li>
            <li class="separator">/</li>
            <li><a href="{base_url}/articles">Articles</a></li>
            <li class="separator">/</li>
            <li>{keyword}</li>
        </ol>"""
    return breadcrumbs

def generate_sidebar(related_topics, lang='en'):
    """Generate sidebar HTML"""
    related_text = "Related Articles" if lang == 'en' else "Artikel Terkait"
    popular_text = "Popular Articles" if lang == 'en' else "Artikel Populer"
    
    # Generate URL dari title (keyword), bukan dari AI response
    def generate_url_from_title(title):
        """Generate URL dari title (slug) - menggunakan relative path untuk local testing"""
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower())
        # Gunakan relative path agar bisa bekerja di local file system
        return f"{slug}.html"
    
    sidebar = f"""<div class="sidebar-section">
            <h3>{related_text}</h3>
            <ul>"""
    
    for topic in related_topics[:5]:
        title = topic.get('title', '')
        # Generate URL dari title, bukan dari AI response
        url = generate_url_from_title(title)
        sidebar += f'<li><a href="{url}">{title}</a></li>'
    
    sidebar += """</ul>
        </div>
        <div class="sidebar-section">
            <h3>""" + popular_text + """</h3>
            <ul>
                <li><a href="/articles/popular-1">Popular Article 1</a></li>
                <li><a href="/articles/popular-2">Popular Article 2</a></li>
                <li><a href="/articles/popular-3">Popular Article 3</a></li>
            </ul>
        </div>"""
    
    return sidebar

def generate_footer_links(base_url, lang='en'):
    """Generate footer links HTML"""
    footer = f"""<div class="footer-section">
            <h3>About</h3>
            <ul>
                <li><a href="{base_url}/about">About Us</a></li>
                <li><a href="{base_url}/contact">Contact</a></li>
                <li><a href="{base_url}/privacy">Privacy Policy</a></li>
            </ul>
        </div>"""
    return footer

def generate_article_template(keyword, output_file=None, template_file='article-template.html',
                              base_url='https://packaginginsights.b-cdn.net',
                              site_name='Packaging Insights'):
    """Generate article template dengan content AI"""
    import os
    
    # Determine output file
    if not output_file:
        safe_keyword = re.sub(r'[^a-z0-9]+', '-', keyword.lower())
        output_file = f"output/{safe_keyword}.html"
    
    # Create output directory if not exists
    os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else '.', exist_ok=True)
    
    # Load template
    template_path = template_file
    if not os.path.exists(template_path):
        print(f"❌ Template file tidak ditemukan: {template_file}")
        return None
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    
    # Generate content AI
    content_data = get_ai_content(keyword)
    if not content_data:
        print("❌ Failed to generate content")
        return None
    
    # Detect language for HTML lang attribute
    lang_code = detect_language(keyword)
    html_lang = lang_code if lang_code in ['id', 'en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'zh', 'zh-cn', 'zh-tw', 
                                            'ar', 'ru', 'nl', 'pl', 'tr', 'ko', 'vi', 'th', 'hi', 'tl'] else 'en'
    
    # Generate filename and URLs
    filename = os.path.basename(output_file)
    canonical_url = f"{base_url}/articles/{filename}"
    
    # Prepare content
    title = content_data.get('title', keyword)
    # Remove quotes from title for SEO optimization (quotes waste characters)
    title = title.strip('"').strip("'").strip()
    # Ensure title case (capitalize important words) - not all lowercase
    import string
    if title.islower() or title == title.lower():
        # Convert to title case (capitalize first letter of each word)
        title = string.capwords(title)
    # Remove any existing ellipsis
    title = title.replace('...', '').strip()
    # Remove generic words and make it more emotional
    generic_words = ['guide', 'complete', 'ultimate', 'everything', 'comprehensive']
    for word in generic_words:
        if word in title.lower():
            # Replace generic words with emotional triggers
            detected_lang = detect_language(keyword)
            if detected_lang == 'id':
                title = title.replace(word, 'Rahasia').replace('Rahasia', 'Tips Praktis', 1) if 'Rahasia' not in title else title
            else:
                # Add emotional trigger
                if 'why' not in title.lower() and 'how' not in title.lower():
                    title = title.replace(f" {word}", '').replace(f"{word} ", '')
                    # Add emotional element
                    if ':' not in title:
                        title = f"Why {title.split(':')[0] if ':' in title else title} (And How to Finally Succeed)"
                    else:
                        parts = title.split(':')
                        title = f"Why {parts[0]} (And How to {parts[1].strip()})"
            break
    
    # Title enhancement removed - let AI generate natural, sharp titles without hardcoded text
    
    # OPTIMAL SEO: Keep title complete (don't truncate at 60 chars)
    # Google will index the entire title even if it's longer than 60 chars
    # Longer titles = more keywords = better SEO
    # Note: Google may truncate display in SERP, but full title is still indexed
        
        # Post-process: Remove "Mengapa" if title already has sharp/aggressive words
        # "Mengapa" is too soft, prefer more aggressive language
        sharp_words_in_title = ['gagal', 'kesalahan', 'rahasia', 'membongkar', 'terungkap', 'ternyata', 'ini yang', 'hampir semua']
        has_sharp_in_title = any(word in title.lower() for word in sharp_words_in_title)
        if has_sharp_in_title and ('mengapa' in title.lower() or 'Mengapa' in title):
            # Remove "Mengapa" and clean up
            title = title.replace('Mengapa ', '').replace('mengapa ', '').strip()
            # Remove double spaces
            title = ' '.join(title.split())
    
    # Detect language FIRST (before processing meta_desc) to avoid mixing languages
    detected_lang = detect_language(keyword)
    
    # Generate natural, SEO-friendly meta description if missing
    meta_desc = content_data.get('meta_description', '')
    if not meta_desc:
        detected_lang = detect_language(keyword)
        if detected_lang == 'id':
            meta_desc = f"Temukan panduan lengkap tentang {keyword} dan pelajari strategi praktis untuk mencapai hasil terbaik."
        else:
            meta_desc = f"Discover comprehensive guide about {keyword} and learn practical strategies to achieve the best results."
    # Remove quotes and ensure minimum length
    meta_desc = meta_desc.strip('"').strip("'").strip()
    # Remove any existing ellipsis
    meta_desc = meta_desc.replace('...', '').strip()
    # Ensure meta_description is at least 120 chars for SEO (AI should generate 150-160 chars)
    # If too short, keep as-is (AI prompt already instructs 150-160 chars)
    if len(meta_desc) > 160:
            # Truncate to 160 chars, but try to cut at word boundary
            truncated = meta_desc[:160]
            last_space = truncated.rfind(' ')
            # Prefer cutting very close to 160 chars to keep most content
            if last_space >= 155:  # Space at position 155-160 (very close to end)
                meta_desc = truncated[:last_space]
            elif last_space >= 150:  # Space at position 150-155 (close to end)
                meta_desc = truncated[:last_space]
            elif last_space >= 145:  # Space at position 145-150 (acceptable)
                meta_desc = truncated[:last_space]
            elif last_space >= 140:  # Space at position 140-145 (acceptable)
                meta_desc = truncated[:last_space]
            else:
                # If no good space found, use full 160 chars
                meta_desc = truncated
    elif len(meta_desc) > 160:
        # Truncate to 160 chars, but try to cut at word boundary
        truncated = meta_desc[:160]
        last_space = truncated.rfind(' ')
        # Prefer cutting very close to 160 chars to keep most content
        if last_space >= 155:  # Space at position 155-160 (very close to end)
            meta_desc = truncated[:last_space]
        elif last_space >= 150:  # Space at position 150-155 (close to end)
            meta_desc = truncated[:last_space]
        elif last_space >= 145:  # Space at position 145-150 (acceptable)
            meta_desc = truncated[:last_space]
        elif last_space >= 140:  # Space at position 140-145 (acceptable)
            meta_desc = truncated[:last_space]
        else:
            # If no good space found, use full 160 chars
            meta_desc = truncated
    
    # Generate OG:description (can be longer and different from meta description)
    og_desc = content_data.get('og_description', meta_desc)
    # Remove any existing ellipsis
    og_desc = og_desc.replace('...', '').strip()
    
    # Use meta_description as og:description (already optimized and natural)
    # If og_desc is same as meta_desc or too short, use meta_desc directly
    if og_desc == meta_desc or len(og_desc) < 150:
        # Use meta_desc as-is (already optimized by AI, 150-160 chars)
        og_desc = meta_desc
        
        # Only extend if meta_desc is too short for social sharing (shouldn't happen with 150-160 char prompt)
        if len(og_desc) < 150:
            # Extend naturally by repeating key message (but this should rarely happen)
            # Better to let AI generate proper length in prompt
            pass
        
        if len(og_desc) > 200:
            # Truncate to 200 chars, but try to cut at word boundary
            truncated = og_desc[:200]
            last_space = truncated.rfind(' ')
            # Prefer cutting very close to 200 chars to keep most content
            # But ensure we don't cut in the middle of a word
            if last_space >= 195:  # Space at position 195-200 (very close to end - best)
                og_desc = truncated[:last_space]
            elif last_space >= 190:  # Space at position 190-195 (close to end - good)
                og_desc = truncated[:last_space]
            elif last_space >= 185:  # Space at position 185-190 (acceptable)
                og_desc = truncated[:last_space]
            elif last_space >= 180:  # Space at position 180-185 (acceptable)
                og_desc = truncated[:last_space]
            elif last_space >= 175:  # Space at position 175-180 (acceptable if no better option)
                og_desc = truncated[:last_space]
            else:
                # If no good space found, try to find punctuation (., !, ?) as alternative
                last_punct = max(
                    truncated.rfind('.'),
                    truncated.rfind('!'),
                    truncated.rfind('?'),
                    truncated.rfind(',')
                )
                if last_punct >= 180:  # Punctuation found near end
                    og_desc = truncated[:last_punct + 1]  # Include punctuation
                elif last_punct >= 170:  # Punctuation found a bit earlier
                    og_desc = truncated[:last_punct + 1]  # Include punctuation
                else:
                    # If no punctuation found, try to cut at the last complete word before 200
                    # Find the last space before position 200, even if it's earlier
                    if last_space >= 150:  # At least 150 chars
                        og_desc = truncated[:last_space]
                    else:
                        # Last resort: use full 200 chars (better than cutting mid-word)
                        og_desc = truncated
    
    keywords = content_data.get('keywords', keyword)
    if isinstance(keywords, list):
        keywords = ', '.join(keywords)
    
    # H1 = TITLE (konsistensi keyword untuk SEO)
    # Simpan H1 AI sebelum di-overwrite untuk digabung ke opening paragraph
    h1_ai = content_data.get('h1', '')
    title_ai = content_data.get('title', '')
    
    # Pilih yang lebih powerful antara TITLE dan H1 AI untuk digunakan sebagai TITLE dan H1
    # H1 AI biasanya lebih descriptive/powerful, jadi prioritaskan H1 AI jika lebih panjang/powerful
    if h1_ai and title_ai:
        # Compare: pilih yang lebih panjang dan powerful
        # H1 AI biasanya lebih descriptive, jadi jika lebih panjang, gunakan H1 AI
        if len(h1_ai) > len(title_ai) and len(h1_ai) > 30:
            # H1 AI lebih panjang dan powerful, gunakan sebagai TITLE dan H1
            title = h1_ai
            h1 = h1_ai
            content_data['title'] = h1_ai  # Update title juga
        else:
            # TITLE AI lebih powerful atau sama, gunakan TITLE AI
            title = title_ai
            h1 = title_ai
    elif h1_ai:
        # Hanya H1 AI yang ada, gunakan sebagai TITLE dan H1
        title = h1_ai
        h1 = h1_ai
        content_data['title'] = h1_ai  # Update title juga
    elif title_ai:
        # Hanya TITLE AI yang ada, gunakan sebagai TITLE dan H1
        title = title_ai
        h1 = title_ai
    else:
        # Tidak ada keduanya, gunakan keyword
        title = keyword
        h1 = keyword
    
    # Ensure TITLE and H1 title case (capitalize important words) - not all lowercase
    if title.islower() or title == title.lower():
        # Convert to title case (capitalize first letter of each word)
        title = string.capwords(title)
    if h1.islower() or h1 == h1.lower():
        # Convert to title case (capitalize first letter of each word)
        h1 = string.capwords(h1)
    
    # Opening paragraph = H1 AI + Opening paragraph AI (jika ada)
    opening_ai = content_data.get('opening_paragraph', '')
    if h1_ai and opening_ai:
        # Gabungkan H1 AI + Opening paragraph AI
        default_opening = f"{h1_ai}. {opening_ai}"
    elif h1_ai and not opening_ai:
        # Hanya H1 AI yang ada, gunakan sebagai opening
        default_opening = h1_ai
    elif opening_ai:
        # Hanya opening AI yang ada, gunakan
        default_opening = opening_ai
    elif meta_desc:
        # Use meta_description as fallback
        default_opening = meta_desc
    else:
        # Natural opening variations based on language
        detected_lang = detect_language(keyword)
        if detected_lang == 'id':
            default_opening = f"Pelajari lebih lanjut tentang {keyword} dan temukan strategi yang efektif untuk mencapai hasil terbaik."
        else:
            default_opening = f"Discover how {keyword} can help you achieve better results with proven strategies and expert insights."
    opening = content_data.get('opening_paragraph', default_opening)
    sections = content_data.get('sections', [])
    related_topics = content_data.get('related_topics', [])
    
    # Generate heading
    heading = f'<h1>{h1}</h1>'
    
    # Detect language for fallback content
    detected_lang = detect_language(keyword)
    is_indonesian = detected_lang == 'id'
    
    # Generate content
    content_html = f'<p>{opening}</p>\n\n'
    
    # If no sections, create default sections from opening paragraph
    if not sections:
        print("⚠️  No sections found, creating default content structure")
        # Split opening paragraph into multiple paragraphs if it's long
        opening_words = opening.split()
        if len(opening_words) > 100:
            # Split into 2-3 paragraphs
            mid_point = len(opening_words) // 2
            para1 = ' '.join(opening_words[:mid_point])
            para2 = ' '.join(opening_words[mid_point:])
            content_html = f'<p>{para1}</p>\n\n<p>{para2}</p>\n\n'
        
        # Generate fallback sections based on detected language (SEO-friendly H2 with keyword)
        if is_indonesian:
            content_html += f'<h2>Memahami {keyword} dengan Lebih Baik</h2>\n'
            content_html += f'<p>Untuk memahami {keyword} dengan baik, penting untuk mengetahui konsep dan prinsip dasarnya. Pengetahuan ini akan membantu Anda membuat keputusan yang tepat dan memaksimalkan pengalaman dengan {keyword}.</p>\n\n'
            content_html += f'<h2>Fitur dan Keuntungan Utama {keyword}</h2>\n'
            content_html += f'<p>Salah satu keuntungan utama dari {keyword} adalah berbagai fitur lengkap yang tersedia. Fitur-fitur ini dirancang untuk meningkatkan pengalaman dan memberikan nilai tambah yang signifikan dalam menggunakan {keyword}.</p>\n\n'
            content_html += f'<h2>Tips dan Praktik Terbaik untuk {keyword}</h2>\n'
            content_html += f'<p>Untuk mendapatkan hasil maksimal dari {keyword}, pertimbangkan untuk menerapkan praktik terbaik ini. Mengikuti panduan ini akan membantu Anda mencapai hasil optimal dengan {keyword} dan menghindari kesalahan umum.</p>\n\n'
        else:
            content_html += f'<h2>Understanding {keyword}</h2>\n'
            content_html += f'<p>When exploring {keyword}, it\'s essential to understand the fundamental concepts and principles. This knowledge will help you make informed decisions and maximize your experience with {keyword}.</p>\n\n'
            content_html += f'<h2>Key Features and Benefits of {keyword}</h2>\n'
            content_html += f'<p>One of the primary advantages of {keyword} is its comprehensive range of features. These benefits are designed to enhance your experience and provide significant value when using {keyword}.</p>\n\n'
            content_html += f'<h2>Best Practices and Tips for {keyword}</h2>\n'
            content_html += f'<p>To get the most out of {keyword}, consider implementing these best practices. Following these guidelines will help you achieve optimal results with {keyword} and avoid common mistakes.</p>\n\n'
    else:
        for section in sections:
            h2 = section.get('h2', '')
            paragraphs = section.get('paragraphs', [])
            if h2:
                content_html += f'<h2>{h2}</h2>\n'
            for para in paragraphs:
                if para:
                    para_escaped = para.replace('"', '&quot;').replace("'", "&#39;")
                    content_html += f'<p>{para_escaped}</p>\n'
            content_html += '\n'
    
    # Generate related articles
    def generate_url_from_title(title):
        """Generate URL dari title (slug) - menggunakan relative path untuk local testing"""
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower())
        return f"{slug}.html"
    
    related_html = ''
    for topic in related_topics[:6]:
        title_topic = topic.get('title', '')
        url_topic = generate_url_from_title(title_topic)
        desc_topic = topic.get('description', '')
        related_html += f"""<div class="related-card">
            <h3><a href="{url_topic}">{title_topic}</a></h3>
            <p>{desc_topic}</p>
        </div>"""
    
    # Generate video gallery (placeholder)
    video_gallery = ''
    
    # Current date
    now = datetime.now()
    date_iso = now.strftime('%Y-%m-%d')
    date_formatted = now.strftime('%B %d, %Y')
    current_year = now.year
    
    # Count internal links
    internal_links_count = len(related_topics) + 3  # related + footer links
    
    # No images - set empty for og:image
    featured_image_url = ''
    
    # Replace all placeholders
    replacements = {
        '{{TITLE}}': title,
        '{{META_DESCRIPTION}}': meta_desc,
        '{{KEYWORDS}}': keywords,
        '{{CANONICAL_URL}}': canonical_url,
        '{{OG_TITLE}}': title,
        '{{OG_DESCRIPTION}}': og_desc,
        '{{OG_URL}}': canonical_url,
        '{{OG_IMAGE}}': featured_image_url if featured_image_url else f'{base_url}/images/default-featured.webp',
        '{{SITE_NAME}}': site_name,
        '{{AUTHOR}}': site_name,
        '{{DATE_ISO}}': date_iso,
        '{{DATE_FORMATTED}}': date_formatted,
        '{{BREADCRUMBS}}': generate_breadcrumbs(keyword, base_url),
        '{{HEADING}}': heading,
        '{{CONTENT}}': content_html,
        '{{VIDEO_GALLERY}}': video_gallery,
        '{{RELATED_ARTICLES}}': related_html,
        '{{SIDEBAR}}': generate_sidebar(related_topics, html_lang),
        '{{FOOTER_LINKS}}': generate_footer_links(base_url, html_lang),
        '{{CURRENT_YEAR}}': str(current_year),
        '{{INTERNAL_LINKS_COUNT}}': str(internal_links_count),
        '{{BASE_URL}}': base_url,
    }
    
    # Replace in template
    for placeholder, value in replacements.items():
        template = template.replace(placeholder, value)
    
    # Update HTML lang
    template = template.replace('lang="en"', f'lang="{html_lang}"')
    
    # Save file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(template)
    
    print(f"✅ Template generated: {output_file}")
    return output_file

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("=" * 70)
        print("🚀 GENERATE ARTICLE TEMPLATE DENGAN AI")
        print("=" * 70)
        print()
        print("Usage: python3 generate_article_template_ai.py <keyword> [options]")
        print()
        print("Options:")
        print("  --output FILE          Output file path")
        print("  --template FILE        Template file (default: article-template.html)")
        print("  --base-url URL         Base URL (default: https://packaginginsights.b-cdn.net)")
        print("  --site-name NAME       Site name (default: Packaging Insights)")
        print("  --generate-related     Auto-generate related articles setelah artikel utama")
        print("  --max-depth N          Max depth untuk related (default: 1)")
        print("  --workers N            Number of parallel workers untuk related (default: 5)")
        print()
        print("Example:")
        print("  python3 generate_article_template_ai.py 'slot gacor'")
        print("  python3 generate_article_template_ai.py 'slot gacor' --output output/article.html")
        print("  python3 generate_article_template_ai.py 'slot gacor' --generate-related")
        print("  python3 generate_article_template_ai.py 'slot gacor' --generate-related --max-depth 2")
        print("  python3 generate_article_template_ai.py 'slot gacor' --generate-related --max-depth 2 --workers 20")
        print()
        sys.exit(1)
    
    keyword = sys.argv[1]
    output_file = None
    template_file = 'article-template.html'
    base_url = 'https://packaginginsights.b-cdn.net'
    site_name = 'Packaging Insights'
    generate_related = False
    max_depth = 1
    num_workers = 5
    
    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--output' and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--template' and i + 1 < len(sys.argv):
            template_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--base-url' and i + 1 < len(sys.argv):
            base_url = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--site-name' and i + 1 < len(sys.argv):
            site_name = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--generate-related':
            generate_related = True
            i += 1
        elif sys.argv[i] == '--max-depth' and i + 1 < len(sys.argv):
            max_depth = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--workers' and i + 1 < len(sys.argv):
            num_workers = int(sys.argv[i + 1])
            i += 2
        else:
            i += 1
    
    print("=" * 70)
    print("🚀 GENERATE ARTICLE TEMPLATE DENGAN AI")
    print("=" * 70)
    print()
    print(f"Keyword: {keyword}")
    print(f"Template: {template_file}")
    print(f"AI Service: {AI_SERVICE}")
    print()
    
    result = generate_article_template(keyword, output_file, template_file, base_url, site_name)
    
    if result:
        print()
        print("=" * 70)
        print("✅ BERHASIL!")
        print("=" * 70)
        print(f"File: {result}")
        print("   → Content dari AI")
        print("   → SEO-optimized")
        print("   → Full article template")
        print("   → Ready untuk upload")
        print()
        print("💡 TIP: Enable Page Prerender di Bunny CDN untuk 'super SEO powers'")
        print("   → Instant discovery oleh crawler")
        print("   → Faster indexing")
        print("   → Lihat: BUNNY_PAGE_PRERENDER_GUIDE.md")
        
        # Generate related articles jika diminta
        if generate_related:
            print()
            print("=" * 70)
            print("🔄 GENERATING RELATED ARTICLES...")
            print("=" * 70)
            print()
            
            try:
                from batch_generate_related_articles import batch_generate_related
                
                # Determine output directory
                output_dir = os.path.dirname(result) if os.path.dirname(result) else 'output'
                
                related_files = batch_generate_related(
                    result,
                    output_dir=output_dir,
                    max_depth=max_depth,
                    base_url=base_url,
                    site_name=site_name,
                    num_workers=num_workers
                )
                
                if related_files:
                    print()
                    print("=" * 70)
                    print("✅ RELATED ARTICLES GENERATED!")
                    print("=" * 70)
                    print(f"Total related files: {len(related_files)}")
                    for rf in related_files:
                        print(f"   → {rf}")
                else:
                    print()
                    print("⚠️  Tidak ada related articles yang di-generate")
            except ImportError:
                print("⚠️  batch_generate_related_articles.py tidak ditemukan")
                print("   Skip generate related articles")
            except Exception as e:
                print(f"⚠️  Error generating related articles: {e}")
    else:
        print()
        print("=" * 70)
        print("❌ GAGAL")
        print("=" * 70)
