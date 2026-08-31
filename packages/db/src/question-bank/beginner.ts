export const beginnerQuestions = [
  {
    slug: "two-sum",
    title: "Two Sum",
    topic: "data-structures",
    tags: ["hash-map", "array-traversal", "lookup"],
    difficultyId: "beginner",
    promptMd: `# Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`. Each input has exactly one solution, and you may not use the same element twice. Return the answer as two space-separated 0-based indices, with the smaller index first.

**Input Format:**
- First line: two integers \`n\` and \`target\` separated by a space
- Second line: \`n\` integers separated by spaces

**Output Format:**
- Two space-separated integers representing the indices

**Constraints:**
- 2 ≤ n ≤ 10,000
- -1,000,000,000 ≤ nums[i] ≤ 1,000,000,000
- Exactly one valid answer exists`,
    examples: [
      {
        input: "4 9\n2 7 11 15",
        output: "0 1",
        explanation: "nums[0] + nums[1] = 2 + 7 = 9",
      },
    ],
    testCases: [
      { visibility: "public", input: "4 9\n2 7 11 15", expectedOutput: "0 1", weight: 10 },
      { visibility: "public", input: "3 6\n3 2 4", expectedOutput: "1 2", weight: 10 },
      { visibility: "hidden", input: "2 6\n3 3", expectedOutput: "0 1", weight: 20 },
      { visibility: "hidden", input: "5 -8\n-1 -2 -3 -4 -5", expectedOutput: "2 4", weight: 20 },
      { visibility: "hidden", input: "5 9\n1 5 3 7 2", expectedOutput: "3 4", weight: 20 },
      { visibility: "hidden", input: "6 10\n1 4 5 3 6 8", expectedOutput: "2 4", weight: 20 },
    ],
  },
  {
    slug: "reverse-string",
    title: "Reverse String",
    topic: "strings",
    tags: ["string-reversal", "two-pointers"],
    difficultyId: "beginner",
    promptMd: `# Reverse String

Given a string, return it reversed.

**Input Format:**
- A single line containing a string (may be empty)

**Output Format:**
- A single line containing the reversed string

**Constraints:**
- 0 ≤ length of string ≤ 100,000
- String contains only printable ASCII characters`,
    examples: [
      {
        input: "hello",
        output: "olleh",
        explanation: "The string 'hello' reversed character by character is 'olleh'",
      },
    ],
    testCases: [
      { visibility: "public", input: "hello", expectedOutput: "olleh", weight: 10 },
      { visibility: "public", input: "world", expectedOutput: "dlrow", weight: 10 },
      { visibility: "hidden", input: "", expectedOutput: "", weight: 20 },
      { visibility: "hidden", input: "a", expectedOutput: "a", weight: 20 },
      { visibility: "hidden", input: "abba", expectedOutput: "abba", weight: 20 },
      { visibility: "hidden", input: "abcdef", expectedOutput: "fedcba", weight: 20 },
    ],
  },
  {
    slug: "count-vowels",
    title: "Count Vowels",
    topic: "strings",
    tags: ["character-iteration", "counting", "classification"],
    difficultyId: "beginner",
    promptMd: `# Count Vowels

Given a string, count the number of vowels (a, e, i, o, u) it contains. The count should be case-insensitive.

**Input Format:**
- A single line containing a string

**Output Format:**
- A single integer: the total number of vowels

**Constraints:**
- 0 ≤ length of string ≤ 100,000
- String contains only alphabetic characters and spaces`,
    examples: [
      {
        input: "hello",
        output: "2",
        explanation: "The vowels are 'e' and 'o'",
      },
    ],
    testCases: [
      { visibility: "public", input: "hello", expectedOutput: "2", weight: 10 },
      { visibility: "public", input: "xyz", expectedOutput: "0", weight: 10 },
      { visibility: "hidden", input: "aeiou", expectedOutput: "5", weight: 20 },
      { visibility: "hidden", input: "AEIOU", expectedOutput: "5", weight: 20 },
      { visibility: "hidden", input: "", expectedOutput: "0", weight: 20 },
      { visibility: "hidden", input: "Beautiful", expectedOutput: "5", weight: 20 },
    ],
  },
  {
    slug: "find-max-in-array",
    title: "Find Maximum in Array",
    topic: "arrays",
    tags: ["linear-scan", "extrema", "iteration"],
    difficultyId: "beginner",
    promptMd: `# Find Maximum in Array

Given an array of integers, find and return the maximum value.

**Input Format:**
- First line: an integer \`n\`
- Second line: \`n\` integers separated by spaces

**Output Format:**
- A single integer: the maximum value in the array

**Constraints:**
- 1 ≤ n ≤ 100,000
- -1,000,000,000 ≤ nums[i] ≤ 1,000,000,000`,
    examples: [
      {
        input: "5\n1 3 5 2 4",
        output: "5",
        explanation: "The maximum value among 1, 3, 5, 2, 4 is 5",
      },
    ],
    testCases: [
      { visibility: "public", input: "5\n1 3 5 2 4", expectedOutput: "5", weight: 10 },
      { visibility: "public", input: "3\n-5 -1 -3", expectedOutput: "-1", weight: 10 },
      { visibility: "hidden", input: "1\n7", expectedOutput: "7", weight: 20 },
      { visibility: "hidden", input: "3\n4 4 4", expectedOutput: "4", weight: 20 },
      { visibility: "hidden", input: "3\n-10 -5 -20", expectedOutput: "-5", weight: 20 },
      { visibility: "hidden", input: "5\n1 2 3 4 5", expectedOutput: "5", weight: 20 },
    ],
  },
  {
    slug: "palindrome-check",
    title: "Palindrome Check",
    topic: "pointers",
    tags: ["two-pointers", "string-comparison", "symmetry"],
    difficultyId: "beginner",
    promptMd: `# Palindrome Check

Given a string, determine if it reads the same forwards and backwards. Consider only lowercase alphabetic characters. Return \`true\` if it is a palindrome, \`false\` otherwise.

**Input Format:**
- A single line containing a string (lowercase, no spaces)

**Output Format:**
- A single word: \`true\` or \`false\`

**Constraints:**
- 0 ≤ length of string ≤ 100,000
- String contains only lowercase English letters`,
    examples: [
      {
        input: "racecar",
        output: "true",
        explanation: "'racecar' reads the same forwards and backwards",
      },
    ],
    testCases: [
      { visibility: "public", input: "racecar", expectedOutput: "true", weight: 10 },
      { visibility: "public", input: "hello", expectedOutput: "false", weight: 10 },
      { visibility: "hidden", input: "", expectedOutput: "true", weight: 20 },
      { visibility: "hidden", input: "a", expectedOutput: "true", weight: 20 },
      { visibility: "hidden", input: "abba", expectedOutput: "true", weight: 20 },
      { visibility: "hidden", input: "abca", expectedOutput: "false", weight: 20 },
    ],
  },
  {
    slug: "fizz-buzz",
    title: "FizzBuzz",
    topic: "conditions",
    tags: ["conditionals", "modulo", "loops"],
    difficultyId: "beginner",
    promptMd: `# FizzBuzz

Given an integer \`n\`, print numbers from 1 to \`n\`, one per line. However:
- For multiples of 3, print \`Fizz\` instead of the number.
- For multiples of 5, print \`Buzz\` instead of the number.
- For multiples of both 3 and 5, print \`FizzBuzz\` instead of the number.

**Input Format:**
- A single integer \`n\`

**Output Format:**
- \`n\` lines, each containing the FizzBuzz result for that number

**Constraints:**
- 0 ≤ n ≤ 10,000`,
    examples: [
      {
        input: "5",
        output: "1\n2\nFizz\n4\nBuzz",
        explanation: "3 is a multiple of 3 (Fizz), 5 is a multiple of 5 (Buzz)",
      },
    ],
    testCases: [
      { visibility: "public", input: "5", expectedOutput: "1\n2\nFizz\n4\nBuzz", weight: 10 },
      { visibility: "public", input: "3", expectedOutput: "1\n2\nFizz", weight: 10 },
      { visibility: "hidden", input: "15", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", weight: 20 },
      { visibility: "hidden", input: "1", expectedOutput: "1", weight: 20 },
      { visibility: "hidden", input: "0", expectedOutput: "", weight: 20 },
      { visibility: "hidden", input: "30", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz\n22\n23\nFizz\nBuzz\n26\nFizz\n28\n29\nFizzBuzz", weight: 20 },
    ],
  },
  {
    slug: "sum-of-array",
    title: "Sum of Array",
    topic: "functions",
    tags: ["accumulation", "iteration", "reduction"],
    difficultyId: "beginner",
    promptMd: `# Sum of Array

Given an array of integers, return the sum of all elements.

**Input Format:**
- First line: an integer \`n\`
- Second line: \`n\` integers separated by spaces

**Output Format:**
- A single integer: the sum of all elements

**Constraints:**
- 0 ≤ n ≤ 100,000
- -1,000,000,000 ≤ nums[i] ≤ 1,000,000,000`,
    examples: [
      {
        input: "4\n1 2 3 4",
        output: "10",
        explanation: "1 + 2 + 3 + 4 = 10",
      },
    ],
    testCases: [
      { visibility: "public", input: "4\n1 2 3 4", expectedOutput: "10", weight: 10 },
      { visibility: "public", input: "2\n-1 1", expectedOutput: "0", weight: 10 },
      { visibility: "hidden", input: "0\n", expectedOutput: "0", weight: 20 },
      { visibility: "hidden", input: "1\n5", expectedOutput: "5", weight: 20 },
      { visibility: "hidden", input: "3\n-3 -2 -1", expectedOutput: "-6", weight: 20 },
      { visibility: "hidden", input: "3\n1000000 2000000 3000000", expectedOutput: "6000000", weight: 20 },
    ],
  },
  {
    slug: "first-and-last",
    title: "First and Last Position",
    topic: "algorithms",
    tags: ["binary-search", "sorted-array", "boundaries"],
    difficultyId: "beginner",
    promptMd: `# First and Last Position

Given a sorted (non-decreasing) array of integers and a target value, find the first and last position of the target in the array. Return the two 0-based indices separated by a space. If the target is not found, output \`-1 -1\`.

**Input Format:**
- First line: two integers \`n\` and \`target\` separated by a space
- Second line: \`n\` integers in non-decreasing order

**Output Format:**
- Two space-separated integers: the first and last index of target

**Constraints:**
- 1 ≤ n ≤ 100,000
- -1,000,000,000 ≤ nums[i] ≤ 1,000,000,000
- Array is sorted in non-decreasing order`,
    examples: [
      {
        input: "5 2\n1 2 2 3 4",
        output: "1 2",
        explanation: "The target 2 appears at indices 1 and 2",
      },
    ],
    testCases: [
      { visibility: "public", input: "5 2\n1 2 2 3 4", expectedOutput: "1 2", weight: 10 },
      { visibility: "public", input: "5 2\n1 3 5 7 9", expectedOutput: "-1 -1", weight: 10 },
      { visibility: "hidden", input: "5 2\n2 2 2 2 2", expectedOutput: "0 4", weight: 20 },
      { visibility: "hidden", input: "1 1\n1", expectedOutput: "0 0", weight: 20 },
      { visibility: "hidden", input: "5 3\n1 2 3 4 5", expectedOutput: "2 2", weight: 20 },
      { visibility: "hidden", input: "6 2\n1 1 2 2 3 3", expectedOutput: "2 3", weight: 20 },
    ],
  },
  {
    slug: "missing-number",
    title: "Missing Number",
    topic: "algorithms",
    tags: ["math", "sum-formula", "array"],
    difficultyId: "beginner",
    promptMd: `# Missing Number

Given an integer \`n\` and an array of \`n-1\` distinct integers from the range \`[1, n]\`, find and return the one missing number.

**Input Format:**
- First line: an integer \`n\`
- Second line: \`n-1\` integers separated by spaces

**Output Format:**
- A single integer: the missing number

**Constraints:**
- 1 ≤ n ≤ 100,000
- All numbers in the array are unique and in the range [1, n]`,
    examples: [
      {
        input: "3\n1 3",
        output: "2",
        explanation: "The range is [1, 3] and 2 is missing from the array",
      },
    ],
    testCases: [
      { visibility: "public", input: "3\n1 3", expectedOutput: "2", weight: 10 },
      { visibility: "public", input: "5\n1 2 4 5", expectedOutput: "3", weight: 10 },
      { visibility: "hidden", input: "1\n", expectedOutput: "1", weight: 20 },
      { visibility: "hidden", input: "2\n1", expectedOutput: "2", weight: 20 },
      { visibility: "hidden", input: "10\n1 2 3 4 5 6 7 8 10", expectedOutput: "9", weight: 20 },
      { visibility: "hidden", input: "5\n2 3 4 5", expectedOutput: "1", weight: 20 },
    ],
  },
  {
    slug: "binary-search-intro",
    title: "Binary Search",
    topic: "algorithms",
    tags: ["binary-search", "sorted-array", "divide-and-conquer"],
    difficultyId: "beginner",
    promptMd: `# Binary Search

Given a sorted array of distinct integers and a target value, return the index of the target if it exists, otherwise return \`-1\`. You must implement binary search.

**Input Format:**
- First line: two integers \`n\` and \`target\` separated by a space
- Second line: \`n\` integers in strictly increasing order

**Output Format:**
- A single integer: the 0-based index of target, or -1 if not found

**Constraints:**
- 1 ≤ n ≤ 100,000
- All elements are distinct and sorted in strictly increasing order
- -1,000,000,000 ≤ nums[i] ≤ 1,000,000,000`,
    examples: [
      {
        input: "5 5\n1 3 5 7 9",
        output: "2",
        explanation: "Target 5 is found at index 2",
      },
    ],
    testCases: [
      { visibility: "public", input: "5 5\n1 3 5 7 9", expectedOutput: "2", weight: 10 },
      { visibility: "public", input: "5 4\n1 3 5 7 9", expectedOutput: "-1", weight: 10 },
      { visibility: "hidden", input: "6 10\n2 4 6 8 10 12", expectedOutput: "4", weight: 20 },
      { visibility: "hidden", input: "1 1\n1", expectedOutput: "0", weight: 20 },
      { visibility: "hidden", input: "1 2\n1", expectedOutput: "-1", weight: 20 },
      { visibility: "hidden", input: "7 1\n1 2 3 4 5 6 7", expectedOutput: "0", weight: 20 },
    ],
  },
  {
    slug: "remove-duplicates-sorted",
    title: "Remove Duplicates from Sorted Array",
    topic: "arrays",
    tags: ["two-pointers", "deduplication", "in-place"],
    difficultyId: "beginner",
    promptMd: `# Remove Duplicates from Sorted Array

Given a sorted array of integers, remove all duplicates and return the unique elements in their original order, separated by spaces.

**Input Format:**
- First line: an integer \`n\`
- Second line: \`n\` integers in non-decreasing order

**Output Format:**
- Space-separated unique integers in their original order

**Constraints:**
- 0 ≤ n ≤ 100,000
- Array is sorted in non-decreasing order`,
    examples: [
      {
        input: "5\n1 1 2 3 3",
        output: "1 2 3",
        explanation: "Duplicates of 1 and 3 are removed, leaving 1, 2, 3",
      },
    ],
    testCases: [
      { visibility: "public", input: "5\n1 1 2 3 3", expectedOutput: "1 2 3", weight: 10 },
      { visibility: "public", input: "3\n1 2 3", expectedOutput: "1 2 3", weight: 10 },
      { visibility: "hidden", input: "4\n1 1 1 1", expectedOutput: "1", weight: 20 },
      { visibility: "hidden", input: "0\n", expectedOutput: "", weight: 20 },
      { visibility: "hidden", input: "1\n5", expectedOutput: "5", weight: 20 },
      { visibility: "hidden", input: "8\n1 1 2 2 3 3 4 4", expectedOutput: "1 2 3 4", weight: 20 },
    ],
  },
  {
    slug: "swap-case",
    title: "Swap Case",
    topic: "strings",
    tags: ["ascii", "character-transformation", "case-conversion"],
    difficultyId: "beginner",
    promptMd: `# Swap Case

Given a string, swap the case of each alphabetic character. Uppercase letters become lowercase and vice versa. Non-alphabetic characters remain unchanged.

**Input Format:**
- A single line containing a string

**Output Format:**
- A single line with the case-swapped string

**Constraints:**
- 0 ≤ length of string ≤ 100,000
- String contains printable ASCII characters`,
    examples: [
      {
        input: "Hello",
        output: "hELLO",
        explanation: "'H' becomes 'h', 'e' becomes 'E', 'l' becomes 'L', 'l' becomes 'L', 'o' becomes 'O'",
      },
    ],
    testCases: [
      { visibility: "public", input: "Hello", expectedOutput: "hELLO", weight: 10 },
      { visibility: "public", input: "abc", expectedOutput: "ABC", weight: 10 },
      { visibility: "hidden", input: "ABC", expectedOutput: "abc", weight: 20 },
      { visibility: "hidden", input: "123", expectedOutput: "123", weight: 20 },
      { visibility: "hidden", input: "HeLLo WoRLd", expectedOutput: "hEllO wOrld", weight: 20 },
      { visibility: "hidden", input: "", expectedOutput: "", weight: 20 },
    ],
  },
  {
    slug: "fibonacci-sequence",
    title: "Fibonacci Sequence",
    topic: "loops",
    tags: ["sequence", "iteration", "recurrence"],
    difficultyId: "beginner",
    promptMd: `# Fibonacci Number

Given an integer \`n\`, return the \`n\`th Fibonacci number. The sequence is defined as:
- F(0) = 0
- F(1) = 1
- F(n) = F(n-1) + F(n-2) for n ≥ 2

**Input Format:**
- A single integer \`n\`

**Output Format:**
- A single integer: the \`n\`th Fibonacci number

**Constraints:**
- 0 ≤ n ≤ 50`,
    examples: [
      {
        input: "5",
        output: "5",
        explanation: "F(0)=0, F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5",
      },
    ],
    testCases: [
      { visibility: "public", input: "5", expectedOutput: "5", weight: 10 },
      { visibility: "public", input: "0", expectedOutput: "0", weight: 10 },
      { visibility: "hidden", input: "1", expectedOutput: "1", weight: 20 },
      { visibility: "hidden", input: "10", expectedOutput: "55", weight: 20 },
      { visibility: "hidden", input: "20", expectedOutput: "6765", weight: 20 },
      { visibility: "hidden", input: "50", expectedOutput: "12586269025", weight: 20 },
    ],
  },
  {
    slug: "matrix-diagonal-sum",
    title: "Matrix Diagonal Sum",
    topic: "data-structures",
    tags: ["matrix", "diagonal-traversal", "2d-array"],
    difficultyId: "beginner",
    promptMd: `# Matrix Diagonal Sum

Given an \`n × n\` square matrix, return the sum of its main diagonal elements. The main diagonal consists of elements where the row index equals the column index (0-based).

**Input Format:**
- First line: an integer \`n\`
- Next \`n\` lines: each contains \`n\` integers separated by spaces

**Output Format:**
- A single integer: the sum of the main diagonal

**Constraints:**
- 1 ≤ n ≤ 1,000
- -1,000,000,000 ≤ matrix[i][j] ≤ 1,000,000,000`,
    examples: [
      {
        input: "3\n1 2 3\n4 5 6\n7 8 9",
        output: "15",
        explanation: "Diagonal elements: matrix[0][0]=1, matrix[1][1]=5, matrix[2][2]=9. Sum = 1+5+9 = 15",
      },
    ],
    testCases: [
      { visibility: "public", input: "3\n1 2 3\n4 5 6\n7 8 9", expectedOutput: "15", weight: 10 },
      { visibility: "public", input: "2\n1 2\n3 4", expectedOutput: "5", weight: 10 },
      { visibility: "hidden", input: "1\n5", expectedOutput: "5", weight: 20 },
      { visibility: "hidden", input: "3\n1 0 0\n0 1 0\n0 0 1", expectedOutput: "3", weight: 20 },
      { visibility: "hidden", input: "4\n2 4 6 8\n1 3 5 7\n9 8 7 6\n5 4 3 2", expectedOutput: "14", weight: 20 },
      { visibility: "hidden", input: "3\n-1 -2 -3\n-4 -5 -6\n-7 -8 -9", expectedOutput: "-15", weight: 20 },
    ],
  },
  {
    slug: "compress-string",
    title: "Run-Length Encoding",
    topic: "strings",
    tags: ["run-length-encoding", "string-building", "counting"],
    difficultyId: "beginner",
    promptMd: `# Run-Length Encoding

Given a string of lowercase letters, compress it using run-length encoding. Each group of consecutive identical characters is replaced by the character followed by the number of occurrences. Single characters are followed by \`1\`.

**Input Format:**
- A single line containing a string of lowercase English letters

**Output Format:**
- A single line: the run-length encoded string

**Constraints:**
- 1 ≤ length of string ≤ 100,000
- String contains only lowercase English letters`,
    examples: [
      {
        input: "aabcccccaaa",
        output: "a2b1c5a3",
        explanation: "aa→a2, b→b1, ccccc→c5, aaa→a3",
      },
    ],
    testCases: [
      { visibility: "public", input: "aabcccccaaa", expectedOutput: "a2b1c5a3", weight: 10 },
      { visibility: "public", input: "abcd", expectedOutput: "a1b1c1d1", weight: 10 },
      { visibility: "hidden", input: "aa", expectedOutput: "a2", weight: 20 },
      { visibility: "hidden", input: "aabb", expectedOutput: "a2b2", weight: 20 },
      { visibility: "hidden", input: "aaaaaaaaaa", expectedOutput: "a10", weight: 20 },
      { visibility: "hidden", input: "ab", expectedOutput: "a1b1", weight: 20 },
    ],
  },
];
