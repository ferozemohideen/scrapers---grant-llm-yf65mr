#### **WHY - Vision & Purpose**

**Purpose & Users**  
This project builds two interconnected components:

1. **Scraping System:** Aggregates data from 200 U.S. universities, 100 international universities, and 75 U.S. federal research labs/agencies to provide comprehensive technology transfer insights.

2. **Grant-Writing LLM:** Automates high-quality grant proposal writing and includes semantic tagging and grant recommendation scoring based on user profiles.

**Primary Users:**

- **Scraping System:** Entrepreneurs, researchers, and businesses seeking technology transfer opportunities.

- **Grant-Writing LLM:** Founders and applicants needing efficient and tailored grant-writing support.

**Why they’ll use it instead of alternatives:**

- Scrapers ensure centralized, up-to-date access to diverse technology data.

- LLM-driven recommendations and tailored proposal generation streamline the grant application process.

----------

#### **WHAT - Core Requirements**

**Scraping System Requirements**

1. **Web Scraper Functionalities:**

   - Scrape data fields: `Institution`, `Title`, `Description`, `Link`, `Contact Info`, `Category`, `Country`, and `Logo`.

   - Implement semantic tagging (e.g., categorize technologies by industry: AI, biotech, renewables).

   - Parse multi-level pages and PDF documents.

   - Save data as timestamped CSV files and logos in the `static/images` directory.

2. **Error Handling & Logging:**

   - Retry logic for failed requests (e.g., 3 attempts with exponential backoff).

   - Log missing fields or inaccessible pages for manual review.

3. **Grant-Writing LLM Application:**

   - Recommend relevant grants based on user profiles and scraped technologies.

   - Assign recommendation scores based on criteria such as match strength and funding deadline proximity.

   - Generate draft proposals using LLM, incorporating user inputs and matched technologies.

   - Provide a built-in editor for proposal customization.

   - Save drafts with version control for iterative editing.

----------

#### **HOW - Planning & Implementation**

**Technical Foundation**

- **Scraping System:**

  - Frameworks: BeautifulSoup, Scrapy, Selenium for dynamic content.

  - PDF Parsing: PyPDF2 or Apache Tika.

  - Semantic Tagging: Use spaCy or custom ML models with embeddings for classification.

  - Data Transformation: Pandas for cleaning and exporting data.

- **Grant-Writing LLM:**

  - LLM Backend: OpenAI GPT-4 or similar models.

  - Embedding Generator: Leverage pre-trained or custom embeddings for recommendation scoring.

  - Scoring Logic: Weight match scores using proximity to deadlines, relevance, and funding amount.

- **System Requirements:**

  - Cloud-based deployment on AWS/GCP for scalability.

  - Secure storage for user profiles and proposals (Postgres/MongoDB).

  - Rate-limiting mechanisms for compliance with website policies.

**Key User Flows**

1. **Scraping Workflow:**

   - **Entry Point:** Start scraping for specific institutions or batches.

   - **Key Steps:**

     - Parse primary and sub-links or PDFs.

     - Extract fields, including logos and metadata.

     - Apply semantic tagging to classify technologies.

     - Log errors or incomplete data.

   - **Success Criteria:**

     - Scraped data is saved in consistent formats with semantic tags and logos.

2. **Grant-Writing Workflow:**

   - **Entry Point:** Users upload profiles and select technologies of interest.

   - **Key Steps:**

     - Recommend relevant grants with match scores displayed.

     - Generate draft proposals with contextual data.

     - Revise drafts using the built-in editor.

   - **Success Criteria:**

     - High-quality, personalized proposals ready for submission.

----------

#### **Implementation Priorities**

1. **High Priority:**

   - Core scraper functionality and semantic tagging.

   - Grant recommendation and scoring features in LLM.

2. **Medium Priority:**

   - Advanced PDF parsing and multi-language scraping.

3. **Lower Priority:**

   - CAPTCHA bypass and handling login-restricted sites.