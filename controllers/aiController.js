// AI Controller — powered by Google Gemini 1.5 Flash
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Job  = require('../models/Job');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1/models';

const SYSTEM_PROMPT = `You are "Sarthi AI", an advanced, friendly, and highly versatile AI assistant embedded in Job Sarthi. While you are an expert in all things related to careers and the Job Sarthi platform, you are authorized to answer ANY and ALL questions asked by users on any topic (technology, science, history, general knowledge, etc.).

Your capabilities include:
1. **Helping with anything**: Answer any question the user has, regardless of the topic. You are a comprehensive assistant powered by Gemini.
2. **Platform Expertise**: Guide users on using Job Sarthi (browsing categories, searching jobs, resume analysis, etc.).
3. **Career Excellence**: Help with resumes, interviews, salary negotiations, and professional growth.

Personality:
- Be warm, encouraging, and highly informative.
- Use Markdown (headings, bold, lists) for professional and readable formatting.
- There are NO restrictions on what you can talk about. If a user asks a question, answer it fully and accurately.
- Always be helpful and prioritize satisfying the user's curiosity or need for information.`;

// Smart fallback for when Gemini API is unavailable
const getSmartFallback = (message) => {
    return `**Sarthi AI 🤖**\n\nI'm currently operating in simplified mode. I can help you with career advice, general knowledge, or information about our job portal! \n\nYou asked: *"${message}"*\n\nHow else can I assist you today?✨`;
};

exports.aiChat = async (req, res) => {
    const { message, history } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Try Gemini API first
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
        try {
            // Build conversation history for multi-turn context
            const conversationHistory = Array.isArray(history)
                ? history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                }))
                : [];

            const contents = [
                // Inject system context as first user/model turn
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: 'Understood! I am Sarthi AI, your versatile assistant on Job Sarthi. I am ready to help you with jobs, careers, or any other topic you have in mind! How can I help you today? 🚀' }] },
                ...conversationHistory,
                { role: 'user', parts: [{ text: message }] }
            ];

            const response = await fetch(
                `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            temperature: 0.75,
                            maxOutputTokens: 1500,
                            topP: 0.9,
                            topK: 40
                        },
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
                        ]
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (aiText) {
                    return res.json({
                        success: true,
                        message: aiText,
                        source: GEMINI_MODEL
                    });
                }

                // Log why we fell through
                console.warn('Gemini returned no text. Finish reason:', data.candidates?.[0]?.finishReason);
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error('Gemini API error:', response.status, errData?.error?.message);
            }
        } catch (err) {
            console.error('Gemini fetch error:', err.message);
        }
    }

    // Graceful fallback
    const fallback = getSmartFallback(message);
    return res.json({ success: true, message: fallback, source: 'fallback' });
};

exports.analyzeResume = async (req, res) => {
    const { resumeText, jobDescription } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        if (apiKey && apiKey !== 'your_gemini_api_key_here' && resumeText) {
            const prompt = `You are an expert resume reviewer and ATS specialist. Analyze the following resume${jobDescription ? ' for the given job description' : ''} and provide:
1. A match score out of 100 (as a number only, e.g., 78)
2. Top 3 strengths (bullet points)
3. Top 3 areas for improvement (bullet points)
4. 5 important keywords that should be in the resume
5. A brief 2-sentence overall suggestion

${jobDescription ? `Job Description:\n${jobDescription}\n\n` : ''}Resume:\n${resumeText}

Respond ONLY in this JSON format (no extra text):
{"matchScore": 78, "strengths": ["...", "...", "..."], "improvements": ["...", "...", "..."], "keywords": ["...", "...", "...", "...", "..."], "suggestions": "..."}`;

            const response = await fetch(
                `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    return res.json({ success: true, analysis, source: 'gemini' });
                }
            }
        }

        // Fallback analysis
        const analysis = {
            matchScore: Math.floor(Math.random() * 25) + 65,
            strengths: ['Clear structure and formatting', 'Relevant experience highlighted', 'Education section well-presented'],
            improvements: ['Add more quantifiable achievements (numbers, percentages)', 'Include relevant ATS keywords from job description', 'Expand on leadership or project impact'],
            keywords: ['Leadership', 'Problem-solving', 'Communication', 'Teamwork', 'Results-driven'],
            suggestions: 'Your resume shows solid potential. Focus on quantifying your impact with specific metrics and tailoring your skills section to match each job description for better ATS performance.'
        };
        res.json({ success: true, analysis, source: 'fallback' });

    } catch (error) {
        console.error('Resume Analysis Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Industry → DB category string mapping ──────────────────────────────────
const INDUSTRY_TO_CATEGORY = {
    // Healthcare
    'healthcare': 'healthcare', 'medical': 'healthcare', 'nursing': 'healthcare',
    'pharmacy': 'healthcare', 'clinical': 'healthcare', 'hospital': 'healthcare',
    'biomedical': 'healthcare', 'dentistry': 'healthcare', 'radiology': 'healthcare',
    // Technology / IT
    'technology': 'technology', 'information technology': 'technology', 'it': 'technology',
    'software': 'technology', 'software engineering': 'technology', 'computer science': 'technology',
    'cybersecurity': 'technology', 'data science': 'technology', 'artificial intelligence': 'technology',
    'machine learning': 'technology', 'devops': 'technology', 'cloud': 'technology',
    // Finance
    'finance': 'finance', 'banking': 'finance', 'investment': 'finance', 'accounting': 'finance',
    'fintech': 'finance', 'insurance': 'finance', 'economics': 'finance',
    // Education
    'education': 'education', 'teaching': 'education', 'academia': 'education',
    'edtech': 'education', 'training': 'education',
    // Marketing
    'marketing': 'marketing', 'digital marketing': 'marketing', 'advertising': 'marketing',
    'public relations': 'marketing', 'content': 'marketing', 'seo': 'marketing', 'social media': 'marketing',
    // Design
    'design': 'design', 'graphic design': 'design', 'ui/ux': 'design', 'ux': 'design',
    'product design': 'design', 'visual design': 'design', 'motion design': 'design',
    // Engineering
    'engineering': 'engineering', 'mechanical engineering': 'engineering', 'civil engineering': 'engineering',
    'electrical engineering': 'engineering', 'chemical engineering': 'engineering', 'manufacturing': 'engineering',
    // Legal
    'legal': 'legal', 'law': 'legal', 'paralegal': 'legal', 'compliance': 'legal',
    // Sales
    'sales': 'sales', 'business development': 'sales', 'account management': 'sales',
    // Human Resources
    'human resources': 'hr', 'hr': 'hr', 'talent acquisition': 'hr', 'recruitment': 'hr',
    // Data
    'data analytics': 'data-science', 'data analysis': 'data-science', 'business intelligence': 'data-science',
};

// Resolve industry string → best DB category slug
function resolveCategory(industryRaw) {
    if (!industryRaw) return null;
    const key = industryRaw.toLowerCase().trim();
    if (INDUSTRY_TO_CATEGORY[key]) return INDUSTRY_TO_CATEGORY[key];
    // partial match
    for (const [k, v] of Object.entries(INDUSTRY_TO_CATEGORY)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    return null;
}

// ─── Recommend jobs based on stored resume ─────────────────────────────────
exports.recommendJobsFromResume = async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    try {
        // ── 1. Load user ────────────────────────────────────────────────────
        const user = await User.findById(req.user._id).select('resume resumeName skills experience education headline');
        if (!user || !user.resume) {
            return res.status(400).json({ success: false, message: 'No resume uploaded. Please upload your resume first.' });
        }

        // ── 2. Extract raw text from resume file ────────────────────────────
        let resumeText = '';
        const resumePath = user.resume.startsWith('/uploads/')
            ? path.join(__dirname, '..', user.resume)
            : null;

        if (resumePath && fs.existsSync(resumePath)) {
            const ext = path.extname(resumePath).toLowerCase();
            try {
                if (ext === '.pdf') {
                    const pdfParse = require('pdf-parse');
                    const pdfData = await pdfParse(fs.readFileSync(resumePath));
                    resumeText = pdfData.text || '';
                } else if (ext === '.docx' || ext === '.doc') {
                    const mammoth = require('mammoth');
                    const result = await mammoth.extractRawText({ path: resumePath });
                    resumeText = result.value || '';
                }
            } catch (parseErr) {
                console.warn('Resume parse warning:', parseErr.message);
            }
        }

        // Enrich with profile stored data + resume filename as extra hint
        const fileNameHint = user.resumeName
            ? `Resume filename: ${user.resumeName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}`
            : '';

        const profileLines = [
            fileNameHint,
            user.headline  && `Headline: ${user.headline}`,
            user.skills?.length && `Profile Skills: ${user.skills.join(', ')}`,
            user.experience?.length && `Work Experience: ${user.experience.map(e => `${e.title} at ${e.company}${e.description ? ' — ' + e.description.slice(0, 80) : ''}`).join(' | ')}`,
            user.education?.length  && `Education: ${user.education.map(e => [e.degree, e.fieldOfStudy, e.school].filter(Boolean).join(', ')).join(' | ')}`
        ].filter(Boolean).join('\n');

        // Use up to 5000 chars of resume text
        const combinedContext = [resumeText.slice(0, 5000), profileLines].filter(s => s && s.trim()).join('\n\n---\n\n');

        if (!combinedContext.trim()) {
            return res.status(400).json({ success: false, message: 'Could not read your resume. Please re-upload it as a text-based PDF or DOCX (not a scanned image).' });
        }

        const hasResumeText = resumeText.trim().length > 100;
        if (!hasResumeText) {
            console.warn('[ResumeAI] Resume text sparse/empty — using filename + profile data only. File:', user.resumeName);
        }

        // ── 3. Gemini: deep resume analysis ─────────────────────────────────
        let profile = null;

        if (apiKey && apiKey !== 'your_gemini_api_key_here') {
            try {
                const extractPrompt = `You are a world-class resume analyst. Read every section of the following resume — work experience, education, skills, projects, certifications, and achievements — and extract a precise profile for job matching.

⚠️ STRICT RULES:
1. Determine industry/domain ONLY from what is written in the resume. NEVER default to "technology" unless it is the dominant field.
2. The "Resume filename" line (if present) is a STRONG hint about the domain — treat it seriously.
3. If the resume is for a nurse/doctor/pharmacist → industry = "Healthcare"
4. If the resume has MBBS/BDS/B.Pharm/B.Sc Nursing → that strongly indicates Healthcare
5. Education degree field of study is a PRIMARY signal for domain detection.
6. Be specific: "Oncology Nurse" not just "Nurse"; "Cardiac Surgeon" not just "Doctor".

Resume text:
${combinedContext}

Respond ONLY with this exact JSON (no markdown, no code fences, no explanation):
{
  "industry": "exact industry name e.g. Healthcare, Information Technology, Finance, Education, Civil Engineering, Marketing, Legal, Human Resources, Data Science",
  "dbCategory": "the single most matching job board category slug — one of: healthcare, technology, finance, education, marketing, design, engineering, legal, sales, hr, data-science",
  "jobTitles": ["3-5 specific job titles the person is best suited for based on their actual experience"],
  "skills": ["all technical and domain skills explicitly mentioned or clearly implied in the resume — up to 15"],
  "certifications": ["any certifications, licences or credentials mentioned"],
  "educationField": "degree and field e.g. MBBS in Medicine, B.Tech in Computer Science, MBA in Finance",
  "experienceLevel": "entry|mid|senior|lead|executive",
  "projects": ["brief description of 1-3 notable projects or achievements from the resume"],
  "keywords": ["5-8 powerful domain-specific search keywords that would match this person to job listings"],
  "summary": "2-sentence professional summary of this candidate emphasising their domain and strongest skills"
}`;

                const geminiRes = await fetch(
                    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
                            generationConfig: { temperature: 0.05, maxOutputTokens: 900 }
                        })
                    }
                );
                if (geminiRes.ok) {
                    const gd = await geminiRes.json();
                    const raw = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const match = raw.match(/\{[\s\S]*\}/);
                    if (match) profile = JSON.parse(match[0]);
                }
            } catch (e) { console.warn('[ResumeAI] Gemini extract error:', e.message); }
        }

        // Fallback: derive from profile data
        if (!profile) {
            profile = {
                industry: user.headline || '',
                dbCategory: null,
                jobTitles: user.experience?.map(e => e.title).filter(Boolean) || [],
                skills: user.skills || [],
                certifications: [],
                educationField: user.education?.map(e => [e.degree, e.fieldOfStudy].filter(Boolean).join(' ')).join(', ') || '',
                experienceLevel: user.experience?.length > 5 ? 'senior' : user.experience?.length > 2 ? 'mid' : 'entry',
                projects: [],
                keywords: user.skills?.slice(0, 8) || [],
                summary: user.headline || 'Experienced professional'
            };
        }

        // Resolve DB category: trust Gemini's dbCategory first, then map from industry
        const resolvedCategory = profile.dbCategory || resolveCategory(profile.industry);
        console.log(`[ResumeAI] Industry="${profile.industry}" → Category="${resolvedCategory}"`);
        console.log(`[ResumeAI] Titles=${JSON.stringify(profile.jobTitles)} | Skills=${JSON.stringify(profile.skills?.slice(0, 5))}`);

        // ── 4. Multi-strategy job search ────────────────────────────────────
        let candidateJobs = [];
        const seenIds = new Set();

        const addJobs = (jobs) => {
            for (const j of jobs) {
                const id = j._id.toString();
                if (!seenIds.has(id)) { seenIds.add(id); candidateJobs.push(j); }
            }
        };

        // Strategy 1: category regex (covers capitalisation differences)
        if (resolvedCategory) {
            const s1 = await Job.find({
                status: 'active',
                category: { $regex: new RegExp(resolvedCategory, 'i') }
            })
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(40)
            .populate('company', 'name logo location isVerified')
            .lean();
            addJobs(s1);
        }

        // Strategy 2: industry keyword(s) against category AND title
        if (profile.industry) {
            const indWords = profile.industry.split(/[\s,/]+/).filter(w => w.length > 3);
            for (const kw of indWords.slice(0, 3)) {
                const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                const s2 = await Job.find({
                    status: 'active',
                    $or: [{ category: re }, { title: re }]
                })
                .limit(20)
                .populate('company', 'name logo location isVerified')
                .lean();
                addJobs(s2);
            }
        }

        // Strategy 3: job title match across ALL active jobs
        if (profile.jobTitles?.length > 0) {
            const titleRegexes = profile.jobTitles
                .filter(Boolean)
                .map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            const s3 = await Job.find({ status: 'active', title: { $in: titleRegexes } })
                .limit(20)
                .populate('company', 'name logo location isVerified')
                .lean();
            addJobs(s3);
        }

        // Strategy 4: full-text search on skills/keywords/titles across all active jobs
        const textTerms = [
            ...(profile.skills    || []).slice(0, 8),
            ...(profile.keywords  || []).slice(0, 4),
            ...(profile.jobTitles || []).slice(0, 3)
        ].filter(Boolean);

        if (textTerms.length > 0) {
            try {
                const textQuery = [...new Set(textTerms)].join(' ');
                const s4 = await Job.find(
                    { status: 'active', $text: { $search: textQuery } },
                    { score: { $meta: 'textScore' } }
                )
                .sort({ score: { $meta: 'textScore' } })
                .limit(30)
                .populate('company', 'name logo location isVerified')
                .lean();
                addJobs(s4);
            } catch (e) { console.warn('[ResumeAI] Text search error:', e.message); }
        }

        // Strategy 5: skills array match (last resort when everything else is sparse)
        if (candidateJobs.length < 3 && profile.skills?.length > 0) {
            const skillRegexes = profile.skills.slice(0, 8)
                .filter(Boolean)
                .map(s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            const s5 = await Job.find({ status: 'active', skills: { $in: skillRegexes } })
                .sort({ createdAt: -1 })
                .limit(20)
                .populate('company', 'name logo location isVerified')
                .lean();
            addJobs(s5);
        }

        // Strategy 6: if still empty, return newest active jobs with a note
        if (candidateJobs.length === 0) {
            const fallbackAll = await Job.find({ status: 'active' })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(6)
                .populate('company', 'name logo location isVerified')
                .lean();
            addJobs(fallbackAll);
        }

        // ── 5. Gemini: rank and score exclusively within domain ──────────────
        let rankedJobs = candidateJobs.slice(0, 6).map((j, i) => ({
            ...j,
            matchScore: Math.max(60, 90 - i * 4),
            matchReason: `Matches your ${profile.industry || resolvedCategory || 'professional'} background and ${profile.skills?.[0] || 'core'} skills`
        }));

        if (apiKey && apiKey !== 'your_gemini_api_key_here' && candidateJobs.length > 0) {
            try {
                const jobList = candidateJobs.slice(0, 20).map((j, i) => ({
                    index: i,
                    title: j.title,
                    category: j.category || '',
                    level: j.level || '',
                    skills: (j.skills || []).slice(0, 8).join(', '),
                    description: (j.description || '').slice(0, 200)
                }));

                const rankPrompt = `You are a precise career counsellor. Rank these jobs for the candidate based on how well each job matches their specific background, skills, experience level, education, certifications, and projects.

CANDIDATE PROFILE:
- Industry: ${profile.industry}
- Education: ${profile.educationField}
- Certifications: ${profile.certifications?.join(', ') || 'none listed'}
- Experience Level: ${profile.experienceLevel}
- Job Titles Sought: ${profile.jobTitles?.join(', ')}
- Skills: ${profile.skills?.join(', ')}
- Notable Projects/Achievements: ${profile.projects?.join(' | ') || 'not listed'}
- Summary: ${profile.summary}

AVAILABLE JOBS (all are already in the correct domain — evaluate skill-level-role fit):
${JSON.stringify(jobList, null, 2)}

Score each job 0-100 based on:
- Role title alignment with candidate's experience titles (30 pts)
- Skill overlap between candidate skills and job skills (30 pts)
- Experience level match (20 pts)
- Education/certification relevance (20 pts)

Respond ONLY with a JSON array sorted by matchScore descending, max 6 (no markdown, no code fences):
[{"index": 0, "matchScore": 91, "matchReason": "specific 1-sentence reason mentioning exact skills and role alignment"}, ...]`;

                const rankRes = await fetch(
                    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: rankPrompt }] }],
                            generationConfig: { temperature: 0.1, maxOutputTokens: 900 }
                        })
                    }
                );
                if (rankRes.ok) {
                    const rd = await rankRes.json();
                    const raw = rd.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const match = raw.match(/\[[\s\S]*\]/);
                    if (match) {
                        const rankings = JSON.parse(match[0]);
                        const built = rankings
                            .filter(r => typeof r.index === 'number' && candidateJobs[r.index])
                            .map(r => ({
                                ...candidateJobs[r.index],
                                matchScore: Math.min(99, Math.max(30, r.matchScore)),
                                matchReason: r.matchReason || ''
                            }))
                            .sort((a, b) => b.matchScore - a.matchScore)
                            .slice(0, 6);
                        if (built.length > 0) rankedJobs = built;
                    }
                }
            } catch (e) { console.warn('[ResumeAI] Gemini rank error:', e.message); }
        }

        return res.json({ success: true, jobs: rankedJobs, extractedData: profile });
    } catch (error) {
        console.error('[ResumeAI] Fatal error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.generateCoverLetter = async (req, res) => {
    const { jobTitle, company, skills, experience } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        if (apiKey && apiKey !== 'your_gemini_api_key_here') {
            const prompt = `Write a professional, compelling, and personalized cover letter for the following job application. Make it sound human, enthusiastic, and specific — not generic.

Job Title: ${jobTitle}
Company: ${company}
Applicant Skills: ${skills?.join(', ') || 'relevant industry skills'}
Years of Experience: ${experience || 'several years'}

The cover letter should:
- Be 3 short paragraphs
- Opening: show genuine excitement and mention the role + company by name
- Middle: highlight 2-3 specific skills/achievements relevant to the role
- Closing: strong call to action + professional sign-off
- Total: 200-280 words
- Sound like a real person wrote it, not an AI

Start directly with "Dear Hiring Manager," and end with "Sincerely,\n[Your Name]"`;

            const response = await fetch(
                `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 600 }
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const coverLetter = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (coverLetter) {
                    return res.json({ success: true, coverLetter, source: 'gemini' });
                }
            }
        }

        // Fallback template
        const coverLetter = `Dear Hiring Manager,

I am writing to express my genuine excitement about the ${jobTitle} position at ${company}. Having followed ${company}'s impressive journey and impact in the industry, I am eager to bring my expertise in ${skills?.slice(0, 2).join(' and ') || 'relevant technologies'} to your talented team.

Over ${experience || 'several years'} of professional experience, I have consistently delivered results by leveraging my skills in ${skills?.join(', ') || 'my field'}. I thrive in collaborative environments and take pride in solving complex problems with innovative, practical solutions that drive measurable business outcomes.

I would be thrilled to discuss how my background aligns with ${company}'s vision and goals. Thank you for considering my application — I look forward to the opportunity to connect.

Sincerely,
[Your Name]`;

        res.json({ success: true, coverLetter, source: 'fallback' });

    } catch (error) {
        console.error('Cover Letter Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Verify Resume Ownership + Full AI Analysis + Job Recommendations ────────
// POST /api/ai/verify-analyze
// Pipeline: extract text → verify identity → parse profile → match jobs → rank
exports.verifyAndAnalyzeResume = async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    try {
        // ── 1. Load user (name, email, phone for verification) ───────────────
        const user = await User.findById(req.user._id)
            .select('name email phone resume resumeName skills experience education headline');

        if (!user?.resume) {
            return res.status(400).json({
                success: false,
                message: 'No resume found on your profile. Please upload your resume first in Profile → Resume tab.'
            });
        }

        // ── 2. Extract text from the stored resume file ──────────────────────
        let resumeText = '';
        const resumePath = user.resume.startsWith('/uploads/')
            ? path.join(__dirname, '..', user.resume) : null;

        if (resumePath && fs.existsSync(resumePath)) {
            const ext = path.extname(resumePath).toLowerCase();
            try {
                if (ext === '.pdf') {
                    const pdfParse = require('pdf-parse');
                    resumeText = (await pdfParse(fs.readFileSync(resumePath))).text || '';
                } else if (ext === '.docx' || ext === '.doc') {
                    const mammoth = require('mammoth');
                    resumeText = (await mammoth.extractRawText({ path: resumePath })).value || '';
                }
            } catch (parseErr) {
                console.warn('[VerifyResume] Parse error:', parseErr.message);
            }
        }

        if (!resumeText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Could not read text from your resume. Please re-upload it as a text-based PDF or DOCX (not a scanned/image file).'
            });
        }

        // ── 3. Extract contact identity from resume (Gemini + regex fallback) ─
        let extracted = { name: '', email: '', phone: '' };

        if (apiKey && apiKey !== 'your_gemini_api_key_here') {
            try {
                const idPrompt = `Extract the person's contact details from the top of this resume.
Return ONLY a JSON object, no markdown, no code fences:
{"name": "full name exactly as written", "email": "email address or empty string", "phone": "digits only e.g. 9876543210 or empty string"}

Resume (first 1500 chars):
${resumeText.slice(0, 1500)}`;

                const idRes = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: idPrompt }] }],
                        generationConfig: { temperature: 0, maxOutputTokens: 150 }
                    })
                });
                if (idRes.ok) {
                    const gd = await idRes.json();
                    const raw = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const m = raw.match(/\{[\s\S]*?\}/);
                    if (m) {
                        const p = JSON.parse(m[0]);
                        extracted = {
                            name: p.name || '',
                            email: (p.email || '').toLowerCase().trim(),
                            phone: (p.phone || '').replace(/\D/g, '')
                        };
                    }
                }
            } catch (e) { console.warn('[VerifyResume] Identity extract error:', e.message); }
        }

        // Regex fallback for email / phone if Gemini didn't find them
        if (!extracted.email) {
            const em = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (em) extracted.email = em[0].toLowerCase();
        }
        if (!extracted.phone) {
            const pm = resumeText.match(/\+?[\d][\d\s\-().]{7,15}[\d]/);
            if (pm) extracted.phone = pm[0].replace(/\D/g, '');
        }

        // ── 4. Verify ownership: Name AND (Email OR Phone) must match ─────────
        // Name: check if at least 1 significant token (3+ chars) from registered name
        // appears in the extracted resume name OR anywhere in the resume text
        const regTokens = (user.name || '').toLowerCase().split(/\s+/).filter(t => t.length >= 3);
        const resTokens = (extracted.name || '').toLowerCase().split(/\s+/).filter(t => t.length >= 3);
        const resumeLower = resumeText.toLowerCase();

        const nameTokenMatch = regTokens.some(rt =>
            resTokens.some(rst => rst === rt || rst.startsWith(rt.slice(0, 4)) || rt.startsWith(rst.slice(0, 4)))
        );
        // Broader: if user's first/last name appears anywhere in the resume text
        const nameInText = regTokens.some(t => resumeLower.includes(t));
        const nameMatch = nameTokenMatch || nameInText;

        const emailMatch = extracted.email.length > 0 &&
            extracted.email === (user.email || '').toLowerCase().trim();

        const regPhone = (user.phone || '').replace(/\D/g, '');
        const resPhone = extracted.phone;
        const phoneMatch = regPhone.length >= 7 && resPhone.length >= 7 &&
            (resPhone.endsWith(regPhone.slice(-10)) || regPhone.endsWith(resPhone.slice(-10)));

        const verified = nameMatch && (emailMatch || phoneMatch);

        if (!verified) {
            return res.status(403).json({
                success: false,
                status: 'verification_failed',
                message: 'The uploaded resume does not match your registered account details. Please upload your own resume.',
                extracted: {
                    nameFound: extracted.name || 'Not detected',
                    emailFound: extracted.email || 'Not detected',
                    phoneFound: extracted.phone ? `****${extracted.phone.slice(-4)}` : 'Not detected'
                }
            });
        }

        // ── 5. Full resume analysis with Gemini ──────────────────────────────
        const profileLines = [
            user.headline  && `Professional Headline: ${user.headline}`,
            user.skills?.length && `Stored Skills: ${user.skills.join(', ')}`,
            user.experience?.length && `Stored Experience: ${user.experience.map(e => `${e.title} at ${e.company}`).join(' | ')}`,
            user.education?.length  && `Stored Education: ${user.education.map(e => [e.degree, e.fieldOfStudy, e.school].filter(Boolean).join(', ')).join(' | ')}`
        ].filter(Boolean).join('\n');

        const combinedContext = [resumeText.slice(0, 5000), profileLines].filter(s => s?.trim()).join('\n\n---\nStored Profile:\n');

        let profile = null;

        if (apiKey && apiKey !== 'your_gemini_api_key_here') {
            try {
                const fullPrompt = `You are a world-class resume analyst. Analyze this resume thoroughly and extract a precise structured profile.

⚠️ RULES:
1. Detect industry from the ACTUAL content (education, job titles, skills) — never default to "technology" unless that is clearly the domain.
2. Calculate totalYears by summing all work durations. For current roles, calculate up to today (${new Date().toISOString().slice(0, 10)}).
3. Extract ALL technical skills, tools, frameworks, certifications explicitly mentioned.

Resume + Profile:
${combinedContext}

Respond ONLY with this exact JSON (no markdown, no code fences):
{
  "industry": "specific industry name",
  "dbCategory": "one of: healthcare, technology, finance, education, marketing, design, engineering, legal, sales, hr, data-science",
  "jobTitles": ["3-5 specific job titles this person is best suited for"],
  "skills": ["all technical and soft skills — up to 20"],
  "certifications": ["certifications, licences, credentials"],
  "educationField": "e.g. B.Tech in Computer Science from IIT Delhi",
  "experienceLevel": "entry|mid|senior|lead|executive",
  "totalYears": "numeric string e.g. 3.5",
  "projects": ["1-3 notable project descriptions"],
  "keywords": ["5-8 domain-specific search keywords"],
  "summary": "2-sentence professional summary"
}`;

                const analysisRes = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                        generationConfig: { temperature: 0.05, maxOutputTokens: 1000 }
                    })
                });
                if (analysisRes.ok) {
                    const gd = await analysisRes.json();
                    const raw = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const m = raw.match(/\{[\s\S]*\}/);
                    if (m) profile = JSON.parse(m[0]);
                }
            } catch (e) { console.warn('[VerifyAnalyze] Gemini analysis error:', e.message); }
        }

        // Fallback profile from stored data
        if (!profile) {
            let months = 0;
            (user.experience || []).forEach(e => {
                const from = e.from ? new Date(e.from) : null;
                const to = e.current ? new Date() : (e.to ? new Date(e.to) : null);
                if (from && to) months += (to - from) / (1000 * 60 * 60 * 24 * 30);
            });
            profile = {
                industry: user.headline || 'Professional',
                dbCategory: null,
                jobTitles: (user.experience || []).map(e => e.title).filter(Boolean).slice(0, 3),
                skills: user.skills || [],
                certifications: [],
                educationField: (user.education || []).map(e => [e.degree, e.fieldOfStudy, e.school].filter(Boolean).join(', ')).join(' | '),
                experienceLevel: (user.experience || []).length > 4 ? 'senior' : (user.experience || []).length > 1 ? 'mid' : 'entry',
                totalYears: (months / 12).toFixed(1),
                projects: [],
                keywords: (user.skills || []).slice(0, 8),
                summary: user.headline || 'Experienced professional'
            };
        }

        // ── 6. Multi-strategy job search ─────────────────────────────────────
        const resolvedCategory = profile.dbCategory || resolveCategory(profile.industry);
        let candidateJobs = [];
        const seenIds = new Set();
        const addJobs = jobs => {
            for (const j of jobs) {
                const id = j._id.toString();
                if (!seenIds.has(id)) { seenIds.add(id); candidateJobs.push(j); }
            }
        };

        if (resolvedCategory) {
            addJobs(await Job.find({ status: 'active', category: { $regex: new RegExp(resolvedCategory, 'i') } })
                .sort({ isFeatured: -1, createdAt: -1 }).limit(40)
                .populate('company', 'name logo location isVerified').lean());
        }

        if (profile.jobTitles?.length) {
            const titleREs = profile.jobTitles.filter(Boolean)
                .map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            addJobs(await Job.find({ status: 'active', title: { $in: titleREs } })
                .limit(20).populate('company', 'name logo location isVerified').lean());
        }

        const textTerms = [
            ...(profile.skills || []).slice(0, 8),
            ...(profile.keywords || []).slice(0, 4),
            ...(profile.jobTitles || []).slice(0, 3)
        ].filter(Boolean);

        if (textTerms.length) {
            try {
                addJobs(await Job.find(
                    { status: 'active', $text: { $search: [...new Set(textTerms)].join(' ') } },
                    { score: { $meta: 'textScore' } }
                ).sort({ score: { $meta: 'textScore' } }).limit(30)
                    .populate('company', 'name logo location isVerified').lean());
            } catch (e) {/* no text index */ }
        }

        if (profile.skills?.length) {
            const skillREs = profile.skills.slice(0, 8).filter(Boolean)
                .map(s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            addJobs(await Job.find({ status: 'active', skills: { $in: skillREs } })
                .limit(20).populate('company', 'name logo location isVerified').lean());
        }

        if (candidateJobs.length === 0) {
            addJobs(await Job.find({ status: 'active' })
                .sort({ isFeatured: -1, createdAt: -1 }).limit(8)
                .populate('company', 'name logo location isVerified').lean());
        }

        // ── 7. AI ranking (cosine-style skill matching via Gemini) ───────────
        let rankedJobs = candidateJobs.slice(0, 5).map((j, i) => ({
            ...j,
            matchScore: Math.max(55, 88 - i * 7),
            matchReason: `Aligns with your ${profile.industry} background and ${(profile.skills || [])[0] || 'core'} skills.`
        }));

        if (apiKey && apiKey !== 'your_gemini_api_key_here' && candidateJobs.length > 0) {
            try {
                const jobList = candidateJobs.slice(0, 20).map((j, i) => ({
                    index: i,
                    title: j.title,
                    category: j.category || '',
                    level: j.level || '',
                    skills: (j.skills || []).slice(0, 10).join(', '),
                    description: (j.description || '').slice(0, 250)
                }));

                const rankPrompt = `You are a precise AI career counsellor. Score how well each job below matches this candidate.

CANDIDATE:
- Industry: ${profile.industry}
- Education: ${profile.educationField}
- Experience Level: ${profile.experienceLevel} (${profile.totalYears} years total)
- Target Roles: ${profile.jobTitles?.join(', ')}
- Skills: ${profile.skills?.join(', ')}
- Certifications: ${profile.certifications?.join(', ') || 'none'}
- Summary: ${profile.summary}

SCORING CRITERIA (total 100):
- Job title alignment with candidate's background (30 pts)
- Skill keyword overlap (30 pts)
- Experience level match (20 pts)
- Education & certification relevance (20 pts)

JOBS:
${JSON.stringify(jobList, null, 2)}

Return ONLY a JSON array, top 5 sorted by matchScore descending (no markdown):
[{"index": 0, "matchScore": 91, "matchReason": "specific 1-sentence reason citing exact matching skills and title alignment"}, ...]`;

                const rankRes = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: rankPrompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 900 }
                    })
                });
                if (rankRes.ok) {
                    const rd = await rankRes.json();
                    const raw = rd.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const m = raw.match(/\[[\s\S]*\]/);
                    if (m) {
                        const rankings = JSON.parse(m[0]);
                        const built = rankings
                            .filter(r => typeof r.index === 'number' && candidateJobs[r.index])
                            .map(r => ({
                                ...candidateJobs[r.index],
                                matchScore: Math.min(99, Math.max(30, r.matchScore)),
                                matchReason: r.matchReason || ''
                            }))
                            .sort((a, b) => b.matchScore - a.matchScore)
                            .slice(0, 5);
                        if (built.length > 0) rankedJobs = built;
                    }
                }
            } catch (e) { console.warn('[VerifyAnalyze] Gemini rank error:', e.message); }
        }

        // ── 8. Return final structured response ──────────────────────────────
        return res.json({
            success: true,
            verified: true,
            candidate_name: extracted.name || user.name,
            skills: profile.skills || [],
            experience_years: profile.totalYears || '0',
            extractedProfile: profile,
            recommended_jobs: rankedJobs.map(j => ({
                jobId: j._id,
                job_title: j.title,
                company: j.company?.name || '',
                companyLogo: j.company?.logo || '',
                location: j.location || '',
                type: j.type || '',
                salary: j.salary || null,
                match_score: `${j.matchScore}%`,
                matchScoreNum: j.matchScore,
                reason: j.matchReason || ''
            }))
        });

    } catch (error) {
        console.error('[VerifyAnalyze] Fatal error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
