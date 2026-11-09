#include "hashtable.h"

void table_init(struct table *table, uint32_t capacity, table_hash_func *hash,
                table_compare_func *compare) {
  table->count = 0;
  table->capacity = capacity;
  table->hash = hash;
  table->compare = compare;
  table->buckets = calloc(capacity, sizeof(struct bucket *));
}

void table_clear(struct table *table) {
  for (uint32_t i = 0; i < table->capacity; ++i) {
    struct bucket *bucket = table->buckets[i];
    while (bucket) {
      struct bucket *next = bucket->next;
      free(bucket);
      bucket = next;
    }
    table->buckets[i] = NULL;
  }
  table->count = 0;
}

void table_free(struct table *table) {
  table_clear(table);
  free(table->buckets);
  table->buckets = NULL;
}

static struct bucket *table_find_bucket(struct table *table, void *key) {
  uint32_t index = table->hash(key) % table->capacity;
  struct bucket *bucket = table->buckets[index];
  while (bucket) {
    if (table->compare(bucket->key, key))
      return bucket;
    bucket = bucket->next;
  }
  return NULL;
}

bool table_add(struct table *table, void *key, void *value) {
  struct bucket *existing = table_find_bucket(table, key);
  if (existing) {
    existing->value = value;
    return true;
  }
  uint32_t index = table->hash(key) % table->capacity;
  struct bucket *bucket = malloc(sizeof(struct bucket));
  if (!bucket)
    return false;
  bucket->key = key;
  bucket->value = value;
  bucket->next = table->buckets[index];
  table->buckets[index] = bucket;
  table->count++;
  return true;
}

void table_remove(struct table *table, void *key) {
  uint32_t index = table->hash(key) % table->capacity;
  struct bucket *prev = NULL;
  struct bucket *bucket = table->buckets[index];
  while (bucket) {
    if (table->compare(bucket->key, key)) {
      if (prev)
        prev->next = bucket->next;
      else
        table->buckets[index] = bucket->next;
      free(bucket);
      table->count--;
      return;
    }
    prev = bucket;
    bucket = bucket->next;
  }
}

void *table_find(struct table *table, void *key) {
  struct bucket *bucket = table_find_bucket(table, key);
  return bucket ? bucket->value : NULL;
}
