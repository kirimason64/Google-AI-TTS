/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";

// --- DOM Elements ---
const loginOverlay = document.getElementById('login-overlay') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const passwordInput = document.getElementById('password-input') as HTMLInputElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;
const appDiv = document.getElementById('app') as HTMLDivElement;

const sheetUrlInput = document.getElementById('sheet-url') as HTMLInputElement;
const sheetNameInput = document.getElementById('sheet-name') as HTMLInputElement;
const cellRefInput = document.getElementById('cell-ref') as HTMLInputElement;
const fetchButton = document.getElementById('fetch-button') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Input method elements
const inputMethodRadios = document.querySelectorAll<HTMLInputElement>('input[name="input-method"]');
const sheetInputContainer = document.getElementById('sheet-input-container') as HTMLDivElement;
const docInputContainer = document.getElementById('doc-input-container') as HTMLDivElement;
const docUrlInput = document.getElementById('doc-url') as HTMLInputElement;
const fileInputContainer = document.getElementById('file-input-container') as HTMLDivElement;
const fileUploadInput = document.getElementById('file-upload') as HTMLInputElement;
const directInputContainer = document.getElementById('direct-input-container') as HTMLDivElement;
const directTextInput = document.getElementById('direct-text-input') as HTMLTextAreaElement;
const charCounter = document.getElementById('char-counter') as HTMLDivElement;

// Result container and its children
const outputContent = document.getElementById('output-content') as HTMLDivElement;
const originalTextDisplay = document.getElementById('original-text-display') as HTMLTextAreaElement;
const textDisplay = document.getElementById('text-display') as HTMLTextAreaElement;

// New Gemini TTS controls
const generateAudioButton = document.getElementById('generate-audio-button') as HTMLButtonElement;
const geminiVoiceSelect = document.getElementById('gemini-voice-select') as HTMLSelectElement;

// Audio output elements
const audioOutput = document.getElementById('audio-output') as HTMLDivElement;
const audioPlayer = document.getElementById('audio-player') as HTMLAudioElement;
const downloadLink = document.getElementById('download-link') as HTMLAnchorElement;

// Cover image elements
const imageStyleSelect = document.getElementById('image-style-select') as HTMLSelectElement;
const generateImageButton = document.getElementById('generate-image-button') as HTMLButtonElement;
const imageOutput = document.getElementById('image-output') as HTMLDivElement;
const imageLoader = document.getElementById('image-loader') as HTMLDivElement;
const coverImage = document.getElementById('cover-image') as HTMLImageElement;
const downloadImageLink = document.getElementById('download-image-link') as HTMLAnchorElement;
const imageAspectRatioSelect = document.getElementById('image-aspect-ratio-select') as HTMLSelectElement;
const imageResolutionSelect = document.getElementById('image-resolution-select') as HTMLSelectElement;
const customImagePrompt = document.getElementById('custom-image-prompt') as HTMLTextAreaElement;


// --- Authentication ---
const CORRECT_PASSWORD = 'Sos@18006558';

if (sessionStorage.getItem('isAuthenticated') === 'true') {
  loginOverlay.classList.add('hidden');
  appDiv.classList.remove('hidden');
} else {
  // HTML defaults to showing login and hiding app, so we just attach the listener
  loginForm.addEventListener('submit', (event: Event) => {
    event.preventDefault();
    if (passwordInput.value === CORRECT_PASSWORD) {
      sessionStorage.setItem('isAuthenticated', 'true');
      loginOverlay.style.opacity = '0';
      setTimeout(() => {
        loginOverlay.classList.add('hidden');
      }, 300); // Match CSS transition duration
      appDiv.classList.remove('hidden');
    } else {
      loginError.textContent = 'Mật khẩu không đúng. Vui lòng thử lại.';
      passwordInput.value = '';
      passwordInput.focus();
    }
  });
}


// --- API Key & Prompt Management ---
let apiKey: string | null = null;
let systemPrompt: string | null = null;
let imagePromptInstructions: string | null = null;

/**
 * Fetches the API key from API_key.txt.
 * Caches the key after the first successful fetch.
 * @returns {Promise<string>} The API key.
 * @throws Will throw an error if the key cannot be fetched or is empty.
 */
async function getApiKey(): Promise<string> {
  if (apiKey) {
    return apiKey;
  }
  try {
    const response = await fetch('API_key.txt');
    if (response.status === 404) {
      throw new Error('Không tìm thấy tệp API_key.txt. Vui lòng tạo tệp này và thêm khóa API của bạn vào đó.');
    }
    if (!response.ok) {
      throw new Error('Không thể lấy tệp API_key.txt.');
    }
    const key = (await response.text()).trim();
    if (!key) {
      throw new Error('Tệp API_key.txt trống. Vui lòng thêm khóa API của bạn vào đó.');
    }
    apiKey = key;
    return apiKey;
  } catch (error) {
    console.error('Lỗi khi lấy khóa API:', error);
    if (error instanceof Error) {
        throw new Error(`Không thể tải khóa API: ${error.message}`);
    }
    throw new Error('Đã xảy ra lỗi không xác định khi tải khóa API.');
  }
}

/**
 * Fetches the system prompt from system_prompt.txt.
 * Caches the prompt after the first successful fetch.
 * @returns {Promise<string>} The system prompt.
 * @throws Will throw an error if the prompt cannot be fetched or is empty.
 */
async function getSystemPrompt(): Promise<string> {
  if (systemPrompt) {
    return systemPrompt;
  }
  try {
    const response = await fetch('system_prompt.txt');
    if (!response.ok) {
      throw new Error(`Không thể lấy tệp system_prompt.txt (trạng thái: ${response.status})`);
    }
    const prompt = await response.text();
    if (!prompt) {
      throw new Error('Tệp system_prompt.txt trống.');
    }
    systemPrompt = prompt;
    return systemPrompt;
  } catch (error) {
    console.error('Lỗi khi lấy system prompt:', error);
    if (error instanceof Error) {
        throw new Error(`Không thể tải system prompt: ${error.message}`);
    }
    throw new Error('Đã xảy ra lỗi không xác định khi tải system prompt.');
  }
}

/**
 * Fetches the image prompt instructions from image_prompt.txt.
 * Caches the instructions after the first successful fetch.
 * @returns {Promise<string>} The image prompt instructions.
 * @throws Will throw an error if the instructions cannot be fetched or are empty.
 */
async function getImagePromptInstructions(): Promise<string> {
  if (imagePromptInstructions) {
    return imagePromptInstructions;
  }
  try {
    const response = await fetch('image_prompt.txt');
    if (!response.ok) {
      throw new Error(`Không thể lấy tệp image_prompt.txt (trạng thái: ${response.status})`);
    }
    const prompt = await response.text();
    if (!prompt) {
      throw new Error('Tệp image_prompt.txt trống.');
    }
    imagePromptInstructions = prompt;
    return imagePromptInstructions;
  } catch (error) {
    console.error('Lỗi khi lấy hướng dẫn tạo ảnh:', error);
    if (error instanceof Error) {
        throw new Error(`Không thể tải hướng dẫn tạo ảnh: ${error.message}`);
    }
    throw new Error('Đã xảy ra lỗi không xác định khi tải hướng dẫn tạo ảnh.');
  }
}


// --- Event Listeners ---
fetchButton.addEventListener('click', handleFetchText);
generateAudioButton.addEventListener('click', handleGenerateAudio);
generateImageButton.addEventListener('click', handleGenerateImage);
directTextInput.addEventListener('input', updateCharCounter);


inputMethodRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const selectedMethod = (document.querySelector('input[name="input-method"]:checked') as HTMLInputElement).value;

    // Hide all containers first
    sheetInputContainer.classList.add('hidden');
    directInputContainer.classList.add('hidden');
    docInputContainer.classList.add('hidden');
    fileInputContainer.classList.add('hidden');

    // Show the selected one
    if (selectedMethod === 'sheet') {
      sheetInputContainer.classList.remove('hidden');
    } else if (selectedMethod === 'doc') {
      docInputContainer.classList.remove('hidden');
    } else if (selectedMethod === 'file') {
      fileInputContainer.classList.remove('hidden');
    } else { // 'direct'
      directInputContainer.classList.remove('hidden');
      updateCharCounter();
    }
    
    // Reset state on switch
    originalTextDisplay.value = '';
    textDisplay.value = '';
    audioOutput.classList.add('hidden');
    setStatus('', 'idle');
    generateAudioButton.disabled = true;
    geminiVoiceSelect.disabled = true;
    imageStyleSelect.disabled = true;
    generateImageButton.disabled = true;
    imageAspectRatioSelect.disabled = true;
    imageResolutionSelect.disabled = true;
    customImagePrompt.disabled = true;
    imageOutput.classList.add('hidden');
    fileUploadInput.value = '';
  });
});


// --- AI Text Processing ---

/**
 * Processes the input text using a Gemini model to enhance it for TTS.
 * @param text The raw text to process.
 * @returns The enhanced text with voice instructions.
 */
async function processTextWithAI(text: string): Promise<string> {
    const currentApiKey = await getApiKey();
    const systemInstruction = await getSystemPrompt();
    const ai = new GoogleGenAI({ apiKey: currentApiKey });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: text,
            config: {
                systemInstruction: systemInstruction,
            },
        });
        return response.text;
    } catch (error) {
        console.error('Lỗi trong quá trình xử lý văn bản AI:', error);
        let errorMessage = 'Đã xảy ra lỗi không xác định.';
        if (error instanceof Error) {
            errorMessage = error.message;
            const jsonMatch = errorMessage.match(/({.*})/s);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const errorJson = JSON.parse(jsonMatch[1]);
                    if (errorJson.error?.message) {
                        errorMessage = errorJson.error.message;
                    }
                } catch (e) { /* Not a JSON error message, use the original */ }
            }
        }
        throw new Error(`Xử lý AI thất bại: ${errorMessage}`);
    }
}


// --- Functions ---

/**
 * Updates the character counter for the direct text input area.
 */
function updateCharCounter() {
    const currentLength = directTextInput.value.length;
    charCounter.textContent = `${currentLength} / 10000`;
}

/**
 * Extracts the spreadsheet ID from a Google Sheet URL.
 * @param {string} url The Google Sheet URL.
 * @returns {string|null} The spreadsheet ID or null if not found.
 */
function getSpreadsheetIdFromUrl(url: string): string | null {
  const match = url.match(/\/d\/(.*?)\//);
  return match ? match[1] : null;
}

/**
 * Sets the status message and style.
 * @param {string} message The message to display.
 * @param {'loading' | 'error' | 'success' | 'idle'} type The type of message.
 */
function setStatus(message: string, type: 'loading' | 'error' | 'success' | 'idle' = 'idle') {
  statusDiv.textContent = message;
  statusDiv.className = 'status-container'; // Reset classes
  if (type !== 'idle') {
    statusDiv.classList.add(type);
  }
}

/**
 * Fetches data from the selected source (Google Sheet, Doc, or direct input), processes it with AI, and displays it.
 */
async function handleFetchText() {
  // Reset state
  originalTextDisplay.value = '';
  textDisplay.value = '';
  audioOutput.classList.add('hidden');
  generateAudioButton.textContent = 'Tạo Âm thanh';
  generateAudioButton.classList.remove('success');
  geminiVoiceSelect.disabled = true;
  generateAudioButton.disabled = true;
  imageStyleSelect.disabled = true;
  generateImageButton.disabled = true;
  imageAspectRatioSelect.disabled = true;
  imageResolutionSelect.disabled = true;
  customImagePrompt.disabled = true;
  imageOutput.classList.add('hidden');


  fetchButton.disabled = true;
  setStatus('Đang xử lý...', 'loading');

  try {
    const selectedMethod = (document.querySelector('input[name="input-method"]:checked') as HTMLInputElement).value;
    let rawText: string | undefined;

    if (selectedMethod === 'sheet') {
      const url = sheetUrlInput.value;
      const sheetName = sheetNameInput.value;
      const cellRef = cellRefInput.value;

      if (!url || !sheetName || !cellRef) {
        throw new Error('Vui lòng điền đầy đủ các trường Google Sheet.');
      }

      setStatus('Đang lấy dữ liệu từ trang tính...', 'loading');
      
      const currentApiKey = await getApiKey();
      const spreadsheetId = getSpreadsheetIdFromUrl(url);
      if (!spreadsheetId) {
        throw new Error('URL Google Sheet không hợp lệ. Vui lòng kiểm tra lại định dạng.');
      }
      
      const range = `${sheetName}!${cellRef}`;
      const sheetsApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${currentApiKey}`;

      const response = await fetch(sheetsApiUrl);
      
      if (response.status === 403) {
        throw new Error("Quyền truy cập bị từ chối. Vui lòng đảm bảo tệp của bạn ở chế độ công khai ('Bất kỳ ai có đường liên kết') và khóa API của bạn hợp lệ với Google Sheets API đã được bật.");
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData?.error?.message) {
          if (errorData.error.message.includes('API key not valid') || errorData.error.message.includes('API_KEY_INVALID')) {
              throw new Error('Khóa API không hợp lệ. Vui lòng kiểm tra tệp API_key.txt và đảm bảo Google Sheets API đã được bật cho khóa này.');
          }
          throw new Error(errorData.error.message);
        }
        throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
      }

      const data = await response.json();
      rawText = data.values?.[0]?.[0];

    } else if (selectedMethod === 'doc') {
      const url = docUrlInput.value;
      if (!url) {
        throw new Error('Vui lòng điền URL Google Doc đã được xuất bản lên web.');
      }
      // A simple check to guide users to the correct link format to avoid API errors.
      if (!url.includes('/pub') && !url.includes('/pubhtml')) {
        throw new Error('URL Google Doc không đúng định dạng. Bạn phải sử dụng liên kết "Xuất bản lên web" để tránh lỗi xác thực API.');
      }

      setStatus('Đang lấy dữ liệu từ Google Doc đã xuất bản...', 'loading');

      // Fetch the published HTML page. No API key is needed for this public URL.
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Không thể lấy dữ liệu từ URL. Trạng thái: ${response.status}`);
      }
      const htmlContent = await response.text();

      // Parse the HTML and extract the text content from the body.
      // This strips all HTML tags and formatting.
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Google Docs published pages have a #contents div that holds the main content.
      // Fallback to the whole body if it's not found.
      const contentContainer = doc.getElementById('contents') || doc.body;
      rawText = contentContainer.innerText || '';

      if (!rawText || !rawText.trim()) {
        throw new Error('Không tìm thấy nội dung văn bản trong tài liệu đã xuất bản hoặc tài liệu trống.');
      }
      
    } else if (selectedMethod === 'file') {
      setStatus('Đang đọc tệp...', 'loading');
      const file = fileUploadInput.files?.[0];

      if (!file) {
        throw new Error('Vui lòng chọn một tệp để tải lên.');
      }

      // Check file size (10MB limit)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new Error(`Kích thước tệp không được vượt quá 10MB. Kích thước hiện tại: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      }

      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.txt')) {
        rawText = await file.text();
      } else if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        rawText = result.value;
      } else {
        throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng sử dụng .txt hoặc .docx.');
      }
    } else { // 'direct'
      rawText = directTextInput.value;
      setStatus('Đang lấy văn bản...', 'loading');
    }

    if (rawText && rawText.trim()) {
      originalTextDisplay.value = rawText;
      setStatus('Đã lấy văn bản. Đang xử lý với AI...', 'loading');
      
      const processedText = await processTextWithAI(rawText);
      
      textDisplay.value = processedText;
      setStatus(`Văn bản đã được xử lý thành công. Sẵn sàng để tạo nội dung.`, 'success');
      geminiVoiceSelect.disabled = false;
      generateAudioButton.disabled = false;
      imageStyleSelect.disabled = false;
      generateImageButton.disabled = false;
      imageAspectRatioSelect.disabled = false;
      imageResolutionSelect.disabled = false;
      customImagePrompt.disabled = false;
    } else {
      if (selectedMethod === 'sheet') {
        setStatus(`Ô ${cellRefInput.value} trống hoặc không tìm thấy.`, 'error');
      } else if (selectedMethod === 'doc') {
        setStatus(`Google Doc trống hoặc không thể đọc nội dung.`, 'error');
      } else if (selectedMethod === 'file') {
        setStatus('Tệp được chọn trống hoặc không thể đọc được nội dung.', 'error');
      } else {
        setStatus(`Vui lòng nhập văn bản để xử lý.`, 'error');
      }
    }
  } catch (error) {
    console.error('Lỗi khi lấy hoặc xử lý dữ liệu:', error);
    setStatus(`Lỗi: ${error instanceof Error ? error.message : 'Đã xảy ra một lỗi không xác định.'}`, 'error');
  } finally {
    fetchButton.disabled = false;
  }
}


/**
 * Converts a base64 string to a Uint8Array.
 * @param base64 The base64 string.
 * @returns The Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Creates a WAV file Blob from raw PCM audio data.
 * The Gemini TTS API returns audio at 24000 Hz sample rate.
 * @param pcmData The raw PCM audio data.
 * @returns A Blob representing the WAV file.
 */
function createWavBlob(pcmData: Uint8Array): Blob {
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const numChannels = 1;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true); // Subchunk2Size

    // Write PCM data
    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([view], { type: 'audio/wav' });
}


/**
 * Generates audio from the displayed text using the Gemini API.
 */
async function handleGenerateAudio() {
  const textToSpeak = textDisplay.value;
  if (!textToSpeak) {
    setStatus('Không có văn bản để tạo âm thanh.', 'error');
    return;
  }
  
  // Reset button state for the new attempt
  generateAudioButton.textContent = 'Tạo Âm thanh';
  generateAudioButton.classList.remove('success');

  generateAudioButton.disabled = true;
  geminiVoiceSelect.disabled = true;
  generateImageButton.disabled = true;
  audioOutput.classList.add('hidden');
  setStatus('Đang tạo âm thanh, quá trình này có thể mất một lát...', 'loading');

  try {
    const currentApiKey = await getApiKey(); // Fetch the key from file
    const ai = new GoogleGenAI({ apiKey: currentApiKey });

    const contents = [{
        parts: [{ text: textToSpeak }]
    }];
    
    // The TTS model requires a streaming request with the "AUDIO" modality specified.
    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-preview-tts', 
        contents,
        // @ts-ignore - Using experimental parameters
        config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: geminiVoiceSelect.value,
                    }
                },
            },
        },
    });

    const audioChunks: Uint8Array[] = [];
    for await (const chunk of responseStream) {
        const audioDataChunk = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioDataChunk) {
            audioChunks.push(base64ToUint8Array(audioDataChunk));
        }
    }
    
    if (audioChunks.length > 0) {
      // Concatenate all chunks into a single Uint8Array
      const totalLength = audioChunks.reduce((acc, val) => acc + val.length, 0);
      const concatenatedPcm = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
          concatenatedPcm.set(chunk, offset);
          offset += chunk.length;
      }

      // Create a valid WAV blob from the raw PCM data
      const wavBlob = createWavBlob(concatenatedPcm);
      const audioUrl = URL.createObjectURL(wavBlob);

      audioPlayer.src = audioUrl;
      downloadLink.href = audioUrl;
      downloadLink.download = `speech_${Date.now()}.wav`; // Give downloaded file a unique name
      audioOutput.classList.remove('hidden');
      setStatus('Tạo âm thanh thành công!', 'success');

      // Update button to success state
      generateAudioButton.textContent = 'Đã tạo';
      generateAudioButton.classList.add('success');
    } else {
      throw new Error('Không nhận được dữ liệu âm thanh từ API. Điều này có thể xảy ra nếu khóa API không hợp lệ hoặc văn bản không phù hợp.');
    }

  } catch (error) {
    console.error('Lỗi khi tạo âm thanh:', error);
    let errorMessage = 'Đã xảy ra lỗi không xác định.';
    if (error instanceof Error) {
        errorMessage = error.message;
        const jsonMatch = errorMessage.match(/({.*})/s); // Use 's' flag for multiline
        if (jsonMatch && jsonMatch[1]) {
            try {
                const errorJson = JSON.parse(jsonMatch[1]);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                }
            } catch (e) {
                // Not a JSON error message, use the original message
            }
        }
    }
    
    setStatus(`Lỗi tạo âm thanh: ${errorMessage}`, 'error');
  } finally {
    generateAudioButton.disabled = false;
    geminiVoiceSelect.disabled = false;
    generateImageButton.disabled = false;
  }
}

/**
 * Generates a cover image from the original text using the Gemini API.
 * It first generates a detailed prompt using a text model, then uses that prompt to generate the image.
 */
async function handleGenerateImage() {
  const customPromptText = customImagePrompt.value.trim();
  const textForImage = customPromptText ? customPromptText : originalTextDisplay.value;

  if (!textForImage) {
    setStatus('Không có văn bản nguyên mẫu hoặc prompt tùy chỉnh để tạo ảnh.', 'error');
    return;
  }

  // Disable UI
  generateImageButton.disabled = true;
  imageStyleSelect.disabled = true;
  generateAudioButton.disabled = true;
  imageAspectRatioSelect.disabled = true;
  imageResolutionSelect.disabled = true;
  customImagePrompt.disabled = true;

  imageOutput.classList.remove('hidden');

  // Hide previous result and show loader
  coverImage.classList.add('hidden');
  downloadImageLink.classList.add('hidden');
  imageLoader.classList.remove('hidden');
  setStatus('Đang chuẩn bị prompt cho ảnh...', 'loading');

  try {
    const [currentApiKey, imageInstructions] = await Promise.all([getApiKey(), getImagePromptInstructions()]);
    const ai = new GoogleGenAI({ apiKey: currentApiKey });

    // Get options from selectors
    const selectedStyle = imageStyleSelect.options[imageStyleSelect.selectedIndex].text;
    const selectedAspectRatio = imageAspectRatioSelect.value as "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    const selectedResolution = imageResolutionSelect.value;
    
    // Step 1: Generate a high-quality prompt using the text model
    const promptForPromptGen = `Create a highly detailed and visually rich image prompt in the style of "${selectedStyle}", inspired by the following text. The final prompt should be a single, compelling sentence ready for an image generation model. Text: "${textForImage}"`;
    
    const promptGenResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptForPromptGen,
        config: {
            systemInstruction: imageInstructions,
        },
    });

    const finalImagePrompt = promptGenResponse.text;

    setStatus('Đã tạo prompt. Đang tạo ảnh bìa...', 'loading');
    
    // Add resolution keywords to the final prompt if needed
    let resolutionEnhancer = '';
    if (selectedResolution === 'hd') {
        resolutionEnhancer = ', HD, high definition, high quality';
    } else if (selectedResolution === '4k') {
        resolutionEnhancer = ', 4K resolution, ultra-high definition, hyperrealistic, photorealistic';
    }

    // Step 2: Generate the image using the newly created prompt
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `${finalImagePrompt}${resolutionEnhancer}`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: selectedAspectRatio,
      },
    });

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    const imageUrl = `data:image/png;base64,${base64ImageBytes}`;

    coverImage.src = imageUrl;
    downloadImageLink.href = imageUrl;

    // Hide loader and show image
    imageLoader.classList.add('hidden');
    coverImage.classList.remove('hidden');
    downloadImageLink.classList.remove('hidden');
    setStatus('Tạo ảnh bìa thành công!', 'success');

  } catch (error) {
    console.error('Lỗi khi tạo ảnh:', error);
    const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
    setStatus(`Lỗi tạo ảnh: ${errorMessage}`, 'error');
    imageOutput.classList.add('hidden'); // Hide the image area on error
  } finally {
    // Re-enable UI
    generateImageButton.disabled = false;
    imageStyleSelect.disabled = false;
    generateAudioButton.disabled = false;
    imageAspectRatioSelect.disabled = false;
    imageResolutionSelect.disabled = false;
    customImagePrompt.disabled = false;
  }
}