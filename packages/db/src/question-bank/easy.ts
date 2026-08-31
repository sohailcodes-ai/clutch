export const easyQuestions = [
  {
    slug: 'max-sum-subarray-size-k',
    title: 'Maximum Sum of Subarray of Size K',
    topic: 'algorithms',
    tags: ['sliding-window', 'arrays', 'sum'],
    difficultyId: 'easy' as const,
    promptMd: `# Maximum Sum of Subarray of Size K

Given an array of integers \`nums\` and an integer \`k\`, find the maximum sum of any contiguous subarray of size \`k\`.

## Example 1

\`\`\`
Input: nums = [2, 1, 5, 1, 3, 2], k = 3
Output: 9
Explanation: The subarray [5, 1, 3] has the maximum sum of 9.
\`\`\`

## Example 2

\`\`\`
Input: nums = [1, 2, 3, 4, 5], k = 2
Output: 9
Explanation: The subarray [4, 5] has the maximum sum of 9.
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^5\`
- \`-10^4 <= nums[i] <= 10^4\`
- \`1 <= k <= nums.length\`

## Input Format

- First line contains two integers \`n\` and \`k\`
- Second line contains \`n\` space-separated integers

## Output Format

- A single integer representing the maximum sum`,
    examples: [
      { input: '6 3\n2 1 5 1 3 2', output: '9', explanation: 'The subarray [5, 1, 3] has the maximum sum of 9.' },
      { input: '5 2\n1 2 3 4 5', output: '9', explanation: 'The subarray [4, 5] has the maximum sum of 9.' },
    ],
    testCases: [
      { visibility: 'public', input: '6 3\n2 1 5 1 3 2', expectedOutput: '9', weight: 10 },
      { visibility: 'public', input: '5 2\n1 2 3 4 5', expectedOutput: '9', weight: 10 },
      { visibility: 'hidden', input: '3 3\n1 2 3', expectedOutput: '6', weight: 10 },
      { visibility: 'hidden', input: '5 5\n-1 -2 -3 -4 -5', expectedOutput: '-15', weight: 10 },
      { visibility: 'hidden', input: '6 1\n10 20 30 40 50 60', expectedOutput: '60', weight: 10 },
      { visibility: 'hidden', input: '4 2\n-1 2 3 -2', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '8 4\n1 4 2 10 2 3 1 0 20', expectedOutput: '24', weight: 10 },
      { visibility: 'hidden', input: '1 1\n100', expectedOutput: '100', weight: 10 },
      { visibility: 'hidden', input: '7 3\n3 -1 4 -2 5 -3 6', expectedOutput: '8', weight: 10 },
      { visibility: 'hidden', input: '10 5\n-5 -3 -1 -4 -2 -6 -8 -7 -9 -10', expectedOutput: '-15', weight: 10 },
    ],
  },
  {
    slug: 'binary-search-in-sorted-array',
    title: 'Binary Search in Sorted Array',
    topic: 'algorithms',
    tags: ['binary-search', 'arrays', 'search'],
    difficultyId: 'easy' as const,
    promptMd: `# Binary Search in Sorted Array

Given a sorted array of distinct integers \`nums\` and a target value \`target\`, return the index if the target is found. If not found, return -1.

## Example 1

\`\`\`
Input: nums = [-1, 0, 3, 5, 9, 12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4.
\`\`\`

## Example 2

\`\`\`
Input: nums = [-1, 0, 3, 5, 9, 12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1.
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^4\`
- \`-10^4 < nums[i], target < 10^4\`
- All the integers in \`nums\` are unique
- \`nums\` is sorted in ascending order

## Input Format

- First line contains two integers \`n\` and \`target\`
- Second line contains \`n\` space-separated sorted integers

## Output Format

- A single integer representing the index or -1`,
    examples: [
      { input: '6 9\n-1 0 3 5 9 12', output: '4', explanation: '9 exists in nums and its index is 4.' },
      { input: '6 2\n-1 0 3 5 9 12', output: '-1', explanation: '2 does not exist in nums so return -1.' },
    ],
    testCases: [
      { visibility: 'public', input: '6 9\n-1 0 3 5 9 12', expectedOutput: '4', weight: 10 },
      { visibility: 'public', input: '6 2\n-1 0 3 5 9 12', expectedOutput: '-1', weight: 10 },
      { visibility: 'hidden', input: '1 1\n1', expectedOutput: '0', weight: 10 },
      { visibility: 'hidden', input: '5 1\n1 2 3 4 5', expectedOutput: '0', weight: 10 },
      { visibility: 'hidden', input: '5 5\n1 2 3 4 5', expectedOutput: '4', weight: 10 },
      { visibility: 'hidden', input: '5 3\n1 2 3 4 5', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '7 6\n1 2 3 4 5 6 7', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '8 -5\n-10 -8 -5 -3 0 2 5 8', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '10 15\n1 3 5 7 9 11 13 15 17 19', expectedOutput: '7', weight: 10 },
      { visibility: 'hidden', input: '3 100\n50 100 150', expectedOutput: '1', weight: 10 },
    ],
  },
  {
    slug: 'max-non-overlapping-intervals',
    title: 'Maximum Non-Overlapping Intervals',
    topic: 'algorithms',
    tags: ['greedy', 'intervals', 'sorting'],
    difficultyId: 'easy' as const,
    promptMd: `# Maximum Non-Overlapping Intervals

Given an array of intervals where \`intervals[i] = [start, end]\`, return the maximum number of non-overlapping intervals.

## Example 1

\`\`\`
Input: intervals = [[1,2],[2,3],[3,4],[1,3]]
Output: 3
Explanation: The maximum number of non-overlapping intervals is 3: [1,2], [2,3], [3,4].
\`\`\`

## Example 2

\`\`\`
Input: intervals = [[1,2],[1,2],[1,2]]
Output: 1
Explanation: The maximum number of non-overlapping intervals is 1.
\`\`\`

## Constraints

- \`1 <= intervals.length <= 10^4\`
- \`intervals[i].length == 2\`
- \`0 <= start < end <= 10^4\`

## Input Format

- First line contains \`n\` (number of intervals)
- Next \`n\` lines each contain two integers \`start\` and \`end\`

## Output Format

- A single integer representing the maximum number of non-overlapping intervals`,
    examples: [
      { input: '4\n1 2\n2 3\n3 4\n1 3', output: '3', explanation: 'The maximum number of non-overlapping intervals is 3.' },
      { input: '3\n1 2\n1 2\n1 2', output: '1', explanation: 'The maximum number of non-overlapping intervals is 1.' },
    ],
    testCases: [
      { visibility: 'public', input: '4\n1 2\n2 3\n3 4\n1 3', expectedOutput: '3', weight: 10 },
      { visibility: 'public', input: '3\n1 2\n1 2\n1 2', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '1\n1 5', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '3\n1 2\n3 4\n5 6', expectedOutput: '3', weight: 10 },
      { visibility: 'hidden', input: '3\n1 10\n2 3\n4 5', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '5\n1 2\n2 3\n3 4\n4 5\n5 6', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '4\n1 4\n2 3\n3 4\n4 5', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '2\n1 2\n2 3', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '6\n1 3\n2 4\n3 5\n4 6\n5 7\n6 8', expectedOutput: '4', weight: 10 },
      { visibility: 'hidden', input: '3\n1 1\n1 1\n1 1', expectedOutput: '1', weight: 10 },
    ],
  },
  {
    slug: 'most-frequent-element',
    title: 'Most Frequent Element',
    topic: 'data-structures',
    tags: ['hash-map', 'frequency', 'counting'],
    difficultyId: 'easy' as const,
    promptMd: `# Most Frequent Element

Given an array of integers \`nums\`, return the element that appears the most frequently. If there are multiple elements with the same highest frequency, return the smallest one.

## Example 1

\`\`\`
Input: nums = [1, 3, 2, 1, 4, 1, 3]
Output: 1
Explanation: 1 appears 3 times, which is the most frequent.
\`\`\`

## Example 2

\`\`\`
Input: nums = [4, 4, 5, 5, 6]
Output: 4
Explanation: Both 4 and 5 appear 2 times, but 4 is smaller.
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^5\`
- \`1 <= nums[i] <= 10^9\`

## Input Format

- First line contains \`n\`
- Second line contains \`n\` space-separated integers

## Output Format

- A single integer representing the most frequent element`,
    examples: [
      { input: '7\n1 3 2 1 4 1 3', output: '1', explanation: '1 appears 3 times, which is the most frequent.' },
      { input: '5\n4 4 5 5 6', output: '4', explanation: 'Both 4 and 5 appear 2 times, but 4 is smaller.' },
    ],
    testCases: [
      { visibility: 'public', input: '7\n1 3 2 1 4 1 3', expectedOutput: '1', weight: 10 },
      { visibility: 'public', input: '5\n4 4 5 5 6', expectedOutput: '4', weight: 10 },
      { visibility: 'hidden', input: '1\n42', expectedOutput: '42', weight: 10 },
      { visibility: 'hidden', input: '3\n1 1 2', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '4\n5 5 5 5', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '6\n1 2 3 4 5 6', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '8\n10 20 10 20 30 10 20 10', expectedOutput: '10', weight: 10 },
      { visibility: 'hidden', input: '5\n100 200 300 100 200', expectedOutput: '100', weight: 10 },
      { visibility: 'hidden', input: '7\n7 7 7 1 1 2 2', expectedOutput: '7', weight: 10 },
      { visibility: 'hidden', input: '9\n1 2 2 3 3 3 4 4 4', expectedOutput: '3', weight: 10 },
    ],
  },
  {
    slug: 'two-sum-sorted',
    title: 'Two Sum in Sorted Array',
    topic: 'algorithms',
    tags: ['two-pointer', 'arrays', 'sorted'],
    difficultyId: 'easy' as const,
    promptMd: `# Two Sum in Sorted Array

Given a sorted array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers such that they add up to \`target\`. You may assume that each input has exactly one solution, and you may not use the same element twice.

Return the indices as two space-separated integers (0-indexed).

## Example 1

\`\`\`
Input: nums = [2, 7, 11, 15], target = 9
Output: 0 1
Explanation: nums[0] + nums[1] = 2 + 7 = 9
\`\`\`

## Example 2

\`\`\`
Input: nums = [2, 3, 4], target = 6
Output: 0 2
Explanation: nums[0] + nums[2] = 2 + 4 = 6
\`\`\`

## Constraints

- \`2 <= nums.length <= 10^4\`
- \`-10^4 <= nums[i] <= 10^4\`
- \`nums\` is sorted in ascending order
- Exactly one valid answer exists

## Input Format

- First line contains two integers \`n\` and \`target\`
- Second line contains \`n\` space-separated sorted integers

## Output Format

- Two space-separated integers representing the indices`,
    examples: [
      { input: '4 9\n2 7 11 15', output: '0 1', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
      { input: '3 6\n2 3 4', output: '0 2', explanation: 'nums[0] + nums[2] = 2 + 4 = 6' },
    ],
    testCases: [
      { visibility: 'public', input: '4 9\n2 7 11 15', expectedOutput: '0 1', weight: 10 },
      { visibility: 'public', input: '3 6\n2 3 4', expectedOutput: '0 2', weight: 10 },
      { visibility: 'hidden', input: '2 5\n2 3', expectedOutput: '0 1', weight: 10 },
      { visibility: 'hidden', input: '3 0\n-1 0 1', expectedOutput: '0 2', weight: 10 },
      { visibility: 'hidden', input: '4 10\n1 3 5 7', expectedOutput: '1 3', weight: 10 },
      { visibility: 'hidden', input: '5 8\n1 2 3 4 5', expectedOutput: '1 3', weight: 10 },
      { visibility: 'hidden', input: '3 -3\n-5 -1 -2', expectedOutput: '0 2', weight: 10 },
      { visibility: 'hidden', input: '4 0\n-3 0 1 2', expectedOutput: '0 1', weight: 10 },
      { visibility: 'hidden', input: '6 12\n3 4 5 6 7 8', expectedOutput: '1 5', weight: 10 },
      { visibility: 'hidden', input: '5 100\n10 20 30 40 50', expectedOutput: '3 4', weight: 10 },
    ],
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    topic: 'data-structures',
    tags: ['stack', 'string', 'validation'],
    difficultyId: 'easy' as const,
    promptMd: `# Valid Parentheses

Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

## Example 1

\`\`\`
Input: s = "()"
Output: true
\`\`\`

## Example 2

\`\`\`
Input: s = "()[]{}"
Output: true
\`\`\`

## Example 3

\`\`\`
Input: s = "(]"
Output: false
\`\`\`

## Constraints

- \`1 <= s.length <= 10^4\`
- \`s\` consists of parentheses only: \`'()[]{}'\`

## Input Format

- A single line containing the string \`s\`

## Output Format

- \`true\` if valid, \`false\` otherwise`,
    examples: [
      { input: '()', output: 'true' },
      { input: '()[]{}', output: 'true' },
      { input: '(]', output: 'false' },
    ],
    testCases: [
      { visibility: 'public', input: '()', expectedOutput: 'true', weight: 10 },
      { visibility: 'public', input: '()[]{}', expectedOutput: 'true', weight: 10 },
      { visibility: 'public', input: '(]', expectedOutput: 'false', weight: 10 },
      { visibility: 'hidden', input: '([)]', expectedOutput: 'false', weight: 10 },
      { visibility: 'hidden', input: '{[]}', expectedOutput: 'true', weight: 10 },
      { visibility: 'hidden', input: '(', expectedOutput: 'false', weight: 10 },
      { visibility: 'hidden', input: ')', expectedOutput: 'false', weight: 10 },
      { visibility: 'hidden', input: '([]){}', expectedOutput: 'true', weight: 10 },
      { visibility: 'hidden', input: '((((', expectedOutput: 'false', weight: 10 },
      { visibility: 'hidden', input: '((((()))))', expectedOutput: 'true', weight: 10 },
    ],
  },
  {
    slug: 'factorial-recursive',
    title: 'Factorial Using Recursion',
    topic: 'algorithms',
    tags: ['recursion', 'math', 'basic'],
    difficultyId: 'easy' as const,
    promptMd: `# Factorial Using Recursion

Write a recursive function to compute the factorial of a non-negative integer \`n\`.

The factorial of \`n\` (denoted as \`n!\`) is the product of all positive integers less than or equal to \`n\`.

By definition: \`0! = 1\`

## Example 1

\`\`\`
Input: n = 5
Output: 120
Explanation: 5! = 5 × 4 × 3 × 2 × 1 = 120
\`\`\`

## Example 2

\`\`\`
Input: n = 0
Output: 1
Explanation: 0! = 1
\`\`\`

## Constraints

- \`0 <= n <= 12\`

## Input Format

- A single integer \`n\`

## Output Format

- A single integer representing \`n!\``,
    examples: [
      { input: '5', output: '120', explanation: '5! = 5 × 4 × 3 × 2 × 1 = 120' },
      { input: '0', output: '1', explanation: '0! = 1' },
    ],
    testCases: [
      { visibility: 'public', input: '5', expectedOutput: '120', weight: 10 },
      { visibility: 'public', input: '0', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '1', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '2', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '3', expectedOutput: '6', weight: 10 },
      { visibility: 'hidden', input: '4', expectedOutput: '24', weight: 10 },
      { visibility: 'hidden', input: '6', expectedOutput: '720', weight: 10 },
      { visibility: 'hidden', input: '7', expectedOutput: '5040', weight: 10 },
      { visibility: 'hidden', input: '10', expectedOutput: '3628800', weight: 10 },
      { visibility: 'hidden', input: '12', expectedOutput: '479001600', weight: 10 },
    ],
  },
  {
    slug: 'string-compression',
    title: 'String Compression',
    topic: 'strings',
    tags: ['string', 'two-pointer', 'compression'],
    difficultyId: 'easy' as const,
    promptMd: `# String Compression

Given a string \`s\`, compress it using the following rules:
- If a character appears only once consecutively, keep it as is.
- If a character appears \`k\` times consecutively, replace it with the character followed by \`k\`.

The compression should be applied in-place (output the compressed string).

## Example 1

\`\`\`
Input: s = "aabcccccaaa"
Output: "a2b1c5a3"
Explanation: "aa" becomes "a2", "b" stays "b", "ccccc" becomes "c5", "aaa" becomes "a3".
\`\`\`

## Example 2

\`\`\`
Input: s = "abcdef"
Output: "abcdef"
Explanation: No character repeats consecutively.
\`\`\`

## Constraints

- \`1 <= s.length <= 10^5\`
- \`s\` consists of lowercase English letters only

## Input Format

- A single line containing the string \`s\`

## Output Format

- The compressed string`,
    examples: [
      { input: 'aabcccccaaa', output: 'a2b1c5a3', explanation: '"aa" becomes "a2", "b" stays "b", "ccccc" becomes "c5", "aaa" becomes "a3".' },
      { input: 'abcdef', output: 'abcdef', explanation: 'No character repeats consecutively.' },
    ],
    testCases: [
      { visibility: 'public', input: 'aabcccccaaa', expectedOutput: 'a2b1c5a3', weight: 10 },
      { visibility: 'public', input: 'abcdef', expectedOutput: 'abcdef', weight: 10 },
      { visibility: 'hidden', input: 'a', expectedOutput: 'a', weight: 10 },
      { visibility: 'hidden', input: 'aa', expectedOutput: 'a2', weight: 10 },
      { visibility: 'hidden', input: 'aaa', expectedOutput: 'a3', weight: 10 },
      { visibility: 'hidden', input: 'ab', expectedOutput: 'ab', weight: 10 },
      { visibility: 'hidden', input: 'aabb', expectedOutput: 'a2b2', weight: 10 },
      { visibility: 'hidden', input: 'aaabbb', expectedOutput: 'a3b3', weight: 10 },
      { visibility: 'hidden', input: 'aabbaa', expectedOutput: 'a2b2a2', weight: 10 },
      { visibility: 'hidden', input: 'zzzzzz', expectedOutput: 'z6', weight: 10 },
    ],
  },
  {
    slug: 'two-pointer-squares-sorted',
    title: 'Squares of a Sorted Array',
    topic: 'arrays',
    tags: ['two-pointer', 'sorting', 'arrays'],
    difficultyId: 'easy' as const,
    promptMd: `# Squares of a Sorted Array

Given an integer array \`nums\` sorted in non-decreasing order, return an array of the squares of each number sorted in non-decreasing order.

## Example 1

\`\`\`
Input: nums = [-4, -1, 0, 3, 10]
Output: [0, 1, 9, 16, 100]
Explanation: After squaring, the array becomes [16, 1, 0, 9, 100]. After sorting, it becomes [0, 1, 9, 16, 100].
\`\`\`

## Example 2

\`\`\`
Input: nums = [-7, -3, 2, 3, 11]
Output: [4, 9, 9, 49, 121]
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^4\`
- \`-10^4 <= nums[i] <= 10^4\`
- \`nums\` is sorted in non-decreasing order

## Input Format

- First line contains \`n\`
- Second line contains \`n\` space-separated integers

## Output Format

- \`n\` space-separated integers representing the sorted squares`,
    examples: [
      { input: '5\n-4 -1 0 3 10', output: '0 1 9 16 100' },
      { input: '5\n-7 -3 2 3 11', output: '4 9 9 49 121' },
    ],
    testCases: [
      { visibility: 'public', input: '5\n-4 -1 0 3 10', expectedOutput: '0 1 9 16 100', weight: 10 },
      { visibility: 'public', input: '5\n-7 -3 2 3 11', expectedOutput: '4 9 9 49 121', weight: 10 },
      { visibility: 'hidden', input: '1\n0', expectedOutput: '0', weight: 10 },
      { visibility: 'hidden', input: '2\n-1 0', expectedOutput: '0 1', weight: 10 },
      { visibility: 'hidden', input: '3\n-3 -2 -1', expectedOutput: '1 4 9', weight: 10 },
      { visibility: 'hidden', input: '3\n1 2 3', expectedOutput: '1 4 9', weight: 10 },
      { visibility: 'hidden', input: '4\n-5 -3 0 4', expectedOutput: '0 9 16 25', weight: 10 },
      { visibility: 'hidden', input: '6\n-10 -5 -1 1 3 8', expectedOutput: '1 9 25 64 81 100', weight: 10 },
      { visibility: 'hidden', input: '2\n-100 100', expectedOutput: '10000 10000', weight: 10 },
      { visibility: 'hidden', input: '5\n-10 -5 0 5 10', expectedOutput: '0 25 25 100 100', weight: 10 },
    ],
  },
  {
    slug: 'running-average-stream',
    title: 'Running Average of Stream',
    topic: 'algorithms',
    tags: ['stream', 'averages', 'prefix-sum'],
    difficultyId: 'easy' as const,
    promptMd: `# Running Average of Stream

Given a stream of integers, compute the running average after each element.

## Example 1

\`\`\`
Input: nums = [10, 20, 30, 40, 50]
Output: [10.0, 15.0, 20.0, 25.0, 30.0]
Explanation: Running averages: 10/1=10, (10+20)/2=15, (10+20+30)/3=20, etc.
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^5\`
- \`0 <= nums[i] <= 1000\`

## Input Format

- First line contains \`n\`
- Second line contains \`n\` space-separated integers

## Output Format

- \`n\` space-separated floating-point numbers rounded to 1 decimal place`,
    examples: [
      { input: '5\n10 20 30 40 50', output: '10.0 15.0 20.0 25.0 30.0' },
    ],
    testCases: [
      { visibility: 'public', input: '5\n10 20 30 40 50', expectedOutput: '10.0 15.0 20.0 25.0 30.0', weight: 10 },
      { visibility: 'hidden', input: '1\n100', expectedOutput: '100.0', weight: 10 },
      { visibility: 'hidden', input: '3\n0 0 0', expectedOutput: '0.0 0.0 0.0', weight: 10 },
      { visibility: 'hidden', input: '4\n1 1 1 1', expectedOutput: '1.0 1.0 1.0 1.0', weight: 10 },
      { visibility: 'hidden', input: '3\n1 2 3', expectedOutput: '1.0 1.5 2.0', weight: 10 },
      { visibility: 'hidden', input: '6\n10 20 30 40 50 60', expectedOutput: '10.0 15.0 20.0 25.0 30.0 35.0', weight: 10 },
      { visibility: 'hidden', input: '2\n5 15', expectedOutput: '5.0 10.0', weight: 10 },
      { visibility: 'hidden', input: '5\n1 3 5 7 9', expectedOutput: '1.0 2.0 3.0 4.0 5.0', weight: 10 },
      { visibility: 'hidden', input: '4\n100 200 300 400', expectedOutput: '100.0 150.0 200.0 250.0', weight: 10 },
      { visibility: 'hidden', input: '7\n1 2 3 4 5 6 7', expectedOutput: '1.0 1.5 2.0 2.5 3.0 3.5 4.0', weight: 10 },
    ],
  },
  {
    slug: 'count-vowels-consonants',
    title: 'Count Vowels and Consonants',
    topic: 'strings',
    tags: ['string', 'counting', 'iteration'],
    difficultyId: 'easy' as const,
    promptMd: `# Count Vowels and Consonants

Given a string \`s\`, count the number of vowels and consonants separately. Ignore non-alphabetic characters.

Vowels: a, e, i, o, u (both uppercase and lowercase)
Consonants: all other alphabetic characters

## Example 1

\`\`\`
Input: s = "Hello World"
Output: 3 7
Explanation: Vowels: e, o, o (3). Consonants: H, l, l, W, r, l, d (7).
\`\`\`

## Example 2

\`\`\`
Input: s = "Python"
Output: 1 5
Explanation: Vowels: o (1). Consonants: P, y, t, h, n (5).
\`\`\`

## Constraints

- \`1 <= s.length <= 10^5\`
- \`s\` may contain uppercase and lowercase letters, spaces, and other characters

## Input Format

- A single line containing the string \`s\`

## Output Format

- Two space-separated integers: vowel_count consonant_count`,
    examples: [
      { input: 'Hello World', output: '3 7', explanation: 'Vowels: e, o, o (3). Consonants: H, l, l, W, r, l, d (7).' },
      { input: 'Python', output: '1 5', explanation: 'Vowels: o (1). Consonants: P, y, t, h, n (5).' },
    ],
    testCases: [
      { visibility: 'public', input: 'Hello World', expectedOutput: '3 7', weight: 10 },
      { visibility: 'public', input: 'Python', expectedOutput: '1 5', weight: 10 },
      { visibility: 'hidden', input: 'aeiou', expectedOutput: '5 0', weight: 10 },
      { visibility: 'hidden', input: 'bcdfg', expectedOutput: '0 5', weight: 10 },
      { visibility: 'hidden', input: 'A', expectedOutput: '1 0', weight: 10 },
      { visibility: 'hidden', input: 'B', expectedOutput: '0 1', weight: 10 },
      { visibility: 'hidden', input: '123', expectedOutput: '0 0', weight: 10 },
      { visibility: 'hidden', input: 'Hello World 123', expectedOutput: '3 7', weight: 10 },
      { visibility: 'hidden', input: 'AEIOUaeiou', expectedOutput: '10 0', weight: 10 },
      { visibility: 'hidden', input: 'Programming', expectedOutput: '3 8', weight: 10 },
    ],
  },
  {
    slug: 'prefix-sum-range-query',
    title: 'Prefix Sum Range Query',
    topic: 'algorithms',
    tags: ['prefix-sum', 'arrays', 'query'],
    difficultyId: 'easy' as const,
    promptMd: `# Prefix Sum Range Query

Given an array \`nums\` and multiple queries, answer each query asking for the sum of elements between indices \`left\` and \`right\` (inclusive).

## Example 1

\`\`\`
Input: nums = [1, 2, 3, 4, 5], queries = [[0,2], [1,3], [2,4]]
Output: [6, 9, 12]
Explanation: Sum(0,2) = 1+2+3 = 6, Sum(1,3) = 2+3+4 = 9, Sum(2,4) = 3+4+5 = 12.
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^5\`
- \`0 <= queries.length <= 10^4\`
- \`0 <= left <= right < nums.length\`
- \`-1000 <= nums[i] <= 1000\`

## Input Format

- First line contains \`n\` and \`q\`
- Second line contains \`n\` space-separated integers
- Next \`q\` lines each contain two integers \`left\` and \`right\`

## Output Format

- \`q\` space-separated integers representing the answers`,
    examples: [
      { input: '5 3\n1 2 3 4 5\n0 2\n1 3\n2 4', output: '6 9 12' },
    ],
    testCases: [
      { visibility: 'public', input: '5 3\n1 2 3 4 5\n0 2\n1 3\n2 4', expectedOutput: '6 9 12', weight: 10 },
      { visibility: 'hidden', input: '3 1\n1 2 3\n0 2', expectedOutput: '6', weight: 10 },
      { visibility: 'hidden', input: '4 2\n10 20 30 40\n0 0\n3 3', expectedOutput: '10 40', weight: 10 },
      { visibility: 'hidden', input: '1 1\n100\n0 0', expectedOutput: '100', weight: 10 },
      { visibility: 'hidden', input: '5 1\n1 1 1 1 1\n0 4', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '6 3\n-1 2 -3 4 -5 6\n0 5\n1 4\n2 3', expectedOutput: '3 -2 1', weight: 10 },
      { visibility: 'hidden', input: '3 3\n5 5 5\n0 0\n0 1\n0 2', expectedOutput: '5 10 15', weight: 10 },
      { visibility: 'hidden', input: '4 2\n0 0 0 0\n0 3\n1 2', expectedOutput: '0 0', weight: 10 },
      { visibility: 'hidden', input: '5 2\n10 -5 15 -20 25\n0 4\n1 3', expectedOutput: '25 -10', weight: 10 },
      { visibility: 'hidden', input: '7 3\n1 2 3 4 5 6 7\n0 6\n2 4\n1 5', expectedOutput: '28 12 20', weight: 10 },
    ],
  },
  {
    slug: 'rotate-array-right',
    title: 'Rotate Array Right',
    topic: 'arrays',
    tags: ['arrays', 'rotation', 'two-pointer'],
    difficultyId: 'easy' as const,
    promptMd: `# Rotate Array Right

Given an array \`nums\`, rotate the array to the right by \`k\` steps.

## Example 1

\`\`\`
Input: nums = [1, 2, 3, 4, 5, 6, 7], k = 3
Output: [5, 6, 7, 1, 2, 3, 4]
Explanation: Rotating right by 3 steps: [7,6,5,4,3,2,1] → [5,6,7,1,2,3,4]
\`\`\`

## Example 2

\`\`\`
Input: nums = [-1, -100, 3, 99], k = 2
Output: [3, 99, -1, -100]
\`\`\`

## Constraints

- \`1 <= nums.length <= 10^5\`
- \`-2^31 <= nums[i] <= 2^31 - 1\`
- \`0 <= k <= 10^9\`

## Input Format

- First line contains two integers \`n\` and \`k\`
- Second line contains \`n\` space-separated integers

## Output Format

- \`n\` space-separated integers representing the rotated array`,
    examples: [
      { input: '7 3\n1 2 3 4 5 6 7', output: '5 6 7 1 2 3 4' },
      { input: '4 2\n-1 -100 3 99', output: '3 99 -1 -100' },
    ],
    testCases: [
      { visibility: 'public', input: '7 3\n1 2 3 4 5 6 7', expectedOutput: '5 6 7 1 2 3 4', weight: 10 },
      { visibility: 'public', input: '4 2\n-1 -100 3 99', expectedOutput: '3 99 -1 -100', weight: 10 },
      { visibility: 'hidden', input: '3 0\n1 2 3', expectedOutput: '1 2 3', weight: 10 },
      { visibility: 'hidden', input: '3 3\n1 2 3', expectedOutput: '1 2 3', weight: 10 },
      { visibility: 'hidden', input: '3 5\n1 2 3', expectedOutput: '2 3 1', weight: 10 },
      { visibility: 'hidden', input: '1 1\n42', expectedOutput: '42', weight: 10 },
      { visibility: 'hidden', input: '5 7\n1 2 3 4 5', expectedOutput: '4 5 1 2 3', weight: 10 },
      { visibility: 'hidden', input: '4 1\n10 20 30 40', expectedOutput: '40 10 20 30', weight: 10 },
      { visibility: 'hidden', input: '6 2\n1 2 3 4 5 6', expectedOutput: '5 6 1 2 3 4', weight: 10 },
      { visibility: 'hidden', input: '5 15\n10 20 30 40 50', expectedOutput: '40 50 10 20 30', weight: 10 },
    ],
  },
  {
    slug: 'find-peak-element',
    title: 'Find Peak Element',
    topic: 'algorithms',
    tags: ['binary-search', 'array', 'peak'],
    difficultyId: 'easy' as const,
    promptMd: `# Find Peak Element

A peak element is an element that is strictly greater than its neighbors. Given an array \`nums\`, find a peak element and return its index. If the array contains multiple peaks, return the index to any of the peaks.

You may imagine that \`nums[-1] = nums[n] = -∞\`. In other words, an element is always considered to be strictly greater than a neighbor that is outside the array.

## Example 1

\`\`\`
Input: nums = [1, 2, 3, 1]
Output: 2
Explanation: 3 is a peak element and index 2 is returned.
\`\`\`

## Example 2

\`\`\`
Input: nums = [1, 2, 1, 3, 5, 6, 4]
Output: 5
Explanation: Both index 1 (value 2) and index 5 (value 6) are peaks. Index 5 is returned.
\`\`\`

## Constraints

- \`1 <= nums.length <= 1000\`
- \`-2^31 <= nums[i] <= 2^31 - 1\`
- \`nums[i] != nums[i + 1]\` for all valid \`i\`

## Input Format

- First line contains \`n\`
- Second line contains \`n\` space-separated integers

## Output Format

- A single integer representing the index of a peak element`,
    examples: [
      { input: '4\n1 2 3 1', output: '2', explanation: '3 is a peak element and index 2 is returned.' },
      { input: '7\n1 2 1 3 5 6 4', output: '5', explanation: 'Both index 1 and index 5 are peaks.' },
    ],
    testCases: [
      { visibility: 'public', input: '4\n1 2 3 1', expectedOutput: '2', weight: 10 },
      { visibility: 'public', input: '7\n1 2 1 3 5 6 4', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '1\n1', expectedOutput: '0', weight: 10 },
      { visibility: 'hidden', input: '2\n1 2', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '2\n2 1', expectedOutput: '0', weight: 10 },
      { visibility: 'hidden', input: '3\n1 3 1', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '3\n1 2 3', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '5\n1 2 1 2 1', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '4\n1 2 3 4', expectedOutput: '3', weight: 10 },
      { visibility: 'hidden', input: '4\n4 3 2 1', expectedOutput: '0', weight: 10 },
    ],
  },
  {
    slug: 'min-stack',
    title: 'Min Stack',
    topic: 'data-structures',
    tags: ['stack', 'design', 'minimum'],
    difficultyId: 'easy' as const,
    promptMd: `# Min Stack

Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.

Implement the following operations:
- \`push(val)\`: Pushes the element \`val\` onto the stack.
- \`pop()\`: Removes the element on the top of the stack.
- \`top()\`: Gets the top element of the stack.
- \`getMin()\`: Retrieves the minimum element in the stack.

You must implement a solution with \`O(1)\` time complexity for each function.

## Example 1

\`\`\`
Input: ["MinStack","push","push","push","getMin","pop","top","getMin"]
         [[],[-2],[0],[-3],[],[],[],[]]
Output: [null,null,null,null,-3,null,0,-2]
\`\`\`

## Constraints

- \`-2^31 <= val <= 2^31 - 1\`
- \`pop\`, \`top\`, and \`getMin\` operations will always be called on non-empty stacks
- At most \`3 \times 10^4\` calls will be made to push, pop, top, and getMin

## Input Format

- First line contains \`n\` (number of operations)
- Next \`n\` lines each contain an operation in format \`operation [value]\`
  - Operations: \`push val\`, \`pop\`, \`top\`, \`getMin\`

## Output Format

- For each operation that returns a value, output the return value (one per line)`,
    examples: [
      { input: '7\npush -2\npush 0\npush -3\ngetMin\npop\ntop\ngetMin', output: '-3\n0\n-2' },
    ],
    testCases: [
      { visibility: 'public', input: '7\npush -2\npush 0\npush -3\ngetMin\npop\ntop\ngetMin', expectedOutput: '-3\n0\n-2', weight: 10 },
      { visibility: 'hidden', input: '3\npush 1\ngetMin\ntop', expectedOutput: '1\n1', weight: 10 },
      { visibility: 'hidden', input: '4\npush 5\npush 3\ngetMin\ngetMin', expectedOutput: '3\n3', weight: 10 },
      { visibility: 'hidden', input: '5\npush 10\npush 20\npop\ntop\ngetMin', expectedOutput: '10\n10', weight: 10 },
      { visibility: 'hidden', input: '4\npush -5\npush -3\ngetMin\ntop', expectedOutput: '-5\n-3', weight: 10 },
      { visibility: 'hidden', input: '6\npush 1\npush 2\npush 3\npop\ngetMin\ntop', expectedOutput: '2\n1', weight: 10 },
      { visibility: 'hidden', input: '3\npush 100\ngetMin\ntop', expectedOutput: '100\n100', weight: 10 },
      { visibility: 'hidden', input: '5\npush 5\npush 1\npush 10\ngetMin\ngetMin', expectedOutput: '1\n1', weight: 10 },
      { visibility: 'hidden', input: '4\npush -10\npush -5\npop\ngetMin', expectedOutput: '-10', weight: 10 },
      { visibility: 'hidden', input: '7\npush 3\npush 1\npush 4\ngetMin\npop\ngetMin\ntop', expectedOutput: '1\n1\n1', weight: 10 },
    ],
  },
  {
    slug: 'fibonacci-number',
    title: 'Fibonacci Number',
    topic: 'algorithms',
    tags: ['recursion', 'dynamic-programming', 'math'],
    difficultyId: 'easy' as const,
    promptMd: `# Fibonacci Number

The Fibonacci numbers, commonly denoted \`F(n)\`, form a sequence called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1.

Given \`n\`, calculate \`F(n)\`.

By definition: \`F(0) = 0, F(1) = 1\`
\`F(n) = F(n - 1) + F(n - 2)\`, for \`n > 1\`

## Example 1

\`\`\`
Input: n = 2
Output: 1
Explanation: F(2) = F(1) + F(0) = 1 + 0 = 1
\`\`\`

## Example 2

\`\`\`
Input: n = 4
Output: 3
Explanation: F(4) = F(3) + F(2) = 2 + 1 = 3
\`\`\`

## Constraints

- \`0 <= n <= 30\`

## Input Format

- A single integer \`n\`

## Output Format

- A single integer representing \`F(n)\``,
    examples: [
      { input: '2', output: '1', explanation: 'F(2) = F(1) + F(0) = 1 + 0 = 1' },
      { input: '4', output: '3', explanation: 'F(4) = F(3) + F(2) = 2 + 1 = 3' },
    ],
    testCases: [
      { visibility: 'public', input: '2', expectedOutput: '1', weight: 10 },
      { visibility: 'public', input: '4', expectedOutput: '3', weight: 10 },
      { visibility: 'hidden', input: '0', expectedOutput: '0', weight: 10 },
      { visibility: 'hidden', input: '1', expectedOutput: '1', weight: 10 },
      { visibility: 'hidden', input: '3', expectedOutput: '2', weight: 10 },
      { visibility: 'hidden', input: '5', expectedOutput: '5', weight: 10 },
      { visibility: 'hidden', input: '6', expectedOutput: '8', weight: 10 },
      { visibility: 'hidden', input: '10', expectedOutput: '55', weight: 10 },
      { visibility: 'hidden', input: '20', expectedOutput: '6765', weight: 10 },
      { visibility: 'hidden', input: '30', expectedOutput: '832040', weight: 10 },
    ],
  },
];